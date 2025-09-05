import { todayUTC } from "@/lib/utils";
import { groth16 } from "snarkjs";
import { useWalletClient, useReadContract, usePublicClient } from "wagmi";
import { Groth16VerifierABI } from "@/lib/abi/Groth16Verifier";

export type GenerateProofResp = {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[]; // uint[5] as hex strings
  publicSignals: string[];
};

export async function generateProof(
  sessionId: string,
  challenge: number,
  userDid: string
) {
  // Get circuit inputs from server
  const res = await fetch("/api/generate-proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      challenge,
      userDid,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Server error: ${errorText}`);
  }

  const { circuitInputs, challengeBytes32, didHash } = await res.json();

  const startTime = Date.now();

  // Generate proof on client-side
  const { proof, publicSignals } = await groth16.fullProve(
    circuitInputs,
    "/age_proof_js/age_proof.wasm",
    "/age_proof_0001.zkey"
  );

  const generationTime = Date.now() - startTime;
  console.log(`Proof generated in ${generationTime}ms`);

  // Format proof for smart contract
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
  const argv = JSON.parse("[" + calldata + "]");

  const a: [string, string] = [argv[0][0], argv[0][1]];
  const b: [[string, string], [string, string]] = [
    [argv[1][0][0], argv[1][0][1]],
    [argv[1][1][0], argv[1][1][1]],
  ];
  const c: [string, string] = [argv[2][0], argv[2][1]];

  // Use raw input array from circuit (no reordering needed)
  // Circuit outputs: [currentYear, currentMonth, currentDay, challenge, isOver18]
  // AgeGate contract expects: input[0]=isOver18, input[4]=challenge
  const input: string[] = argv[3];

  console.log("Raw public signals from circuit:", publicSignals);
  console.log("Input array for contract:", input);
  console.log("Input[0] (isOver18):", input[0]);
  console.log("Input[4] (challenge):", input[4]);
  console.log("Challenge comparison:", {
    input4: input[4],
    challengeBytes32: challengeBytes32,
    match: input[4] === challengeBytes32,
  });

  // Debug: Check what each public signal represents (matching smokeVerify)
  console.log("Public signals analysis:");
  console.log("  [0] =", publicSignals[0], "(isOver18 from circuit)");
  console.log("  [1] =", publicSignals[1], "(currentYear from circuit)");
  console.log("  [2] =", publicSignals[2], "(currentMonth from circuit)");
  console.log("  [3] =", publicSignals[3], "(currentDay from circuit)");
  console.log("  [4] =", publicSignals[4], "(challenge from circuit)");
  console.log("Input array for contract:");
  console.log("  [0] =", input[0], "(isOver18 for contract)");
  console.log("  [1] =", input[1], "(currentYear for contract)");
  console.log("  [2] =", input[2], "(currentMonth for contract)");
  console.log("  [3] =", input[3], "(currentDay for contract)");
  console.log("  [4] =", input[4], "(challenge for contract)");

  return {
    a,
    b,
    c,
    input,
    publicSignals,
    challengeBytes32,
    didHash,
  };
}

export async function verifyOnChain(params: {
  a: any;
  b: any;
  c: any;
  input: any;
  challengeBytes32: string;
  didHash: string;
}) {
  const res = await fetch("/api/submit-verification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      a: params.a,
      b: params.b,
      c: params.c,
      input: params.input,
      challengeBytes32: params.challengeBytes32,
      didHash: params.didHash,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Verification error: ${errorText}`);
  }

  return res.json() as Promise<{
    success: boolean;
    isOver18?: boolean;
    proofValid?: boolean;
    message?: string;
    transactionHash?: string;
    blockNumber?: number;
  }>;
}

// Option 1: Direct Groth16Verifier verification (bypasses broken AgeGate)
export async function verifyDirectlyWithGroth16(params: {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[];
  publicClient: any;
}) {
  const { a, b, c, input, publicClient } = params;

  // Call Groth16Verifier directly
  const proofValid = await publicClient.readContract({
    address: "0xCB2F21E45EA243E3CDF4b168a8d8Aad340d181B5", // Groth16Verifier address
    abi: Groth16VerifierABI,
    functionName: "verifyProof",
    args: [a, b, c, input],
  });

  // Check if person is over 18 (input[0] should be 1)
  const isOver18 = BigInt(input[0]) === 1n;

  console.log("Groth16Verifier result:", proofValid);
  console.log("isOver18 from input[0]:", isOver18);
  console.log("Final verification result:", proofValid && isOver18);

  return {
    success: proofValid && isOver18,
    proofValid,
    isOver18,
    message:
      proofValid && isOver18
        ? "Age verification successful"
        : "Age verification failed (under 18)",
  };
}
