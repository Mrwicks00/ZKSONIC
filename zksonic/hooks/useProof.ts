import { todayUTC } from "@/lib/utils";
import { groth16 } from "snarkjs";

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
  const input: string[] = argv[3];

  console.log("Raw public signals from circuit:", publicSignals);
  console.log("Input array for contract:", input);
  console.log("Input[0] (should be isOver18):", input[0]);
  console.log("Input[4] (should be challenge):", input[4]);

  // Debug: Check what each public signal represents
  console.log("Public signals analysis:");
  console.log("  [0] =", publicSignals[0], "(should be isOver18)");
  console.log("  [1] =", publicSignals[1], "(should be currentYear)");
  console.log("  [2] =", publicSignals[2], "(should be currentMonth)");
  console.log("  [3] =", publicSignals[3], "(should be currentDay)");
  console.log("  [4] =", publicSignals[4], "(should be challenge)");

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
    transactionHash?: string;
    blockNumber?: number;
  }>;
}
