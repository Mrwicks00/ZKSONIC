// lib/proof-utils.ts
import path from "path";
import { ethers } from "ethers";
import { ADDRESSES } from "@/lib/addresses";
import { AgeGateABI } from "@/lib/abi/AgeGate";

// Generate proof utility function
export async function generateProofUtil(credential: any, challenge: number) {
  const { birthYear, birthMonth, birthDay } = credential;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();

  const { groth16 } = (await import("snarkjs")) as any;
  const WASM = path.join(process.cwd(), "public/age_proof_js/age_proof.wasm");
  const ZKEY = path.join(process.cwd(), "public/age_proof_0001.zkey");

  const input = {
    birthYear,
    birthMonth,
    birthDay,
    currentYear,
    currentMonth,
    currentDay,
    challenge,
  };

  const { proof, publicSignals } = await groth16.fullProve(input, WASM, ZKEY);

  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
  const argv = calldata
    .replace(/["[\]\s]/g, "")
    .split(",")
    .map((x: string) => BigInt(x).toString());

  const a = [argv[0], argv[1]];
  const b = [
    [argv[2], argv[3]],
    [argv[4], argv[5]],
  ];
  const c = [argv[6], argv[7]];
  const input_array = argv.slice(8);

  return {
    a,
    b,
    c,
    input: input_array,
  };
}

// Verify proof utility function - returns verification data for client-side contract interaction
export async function verifyProofUtil(
  proof: any,
  challenge: number,
  did: string
) {
  const challengeBytes32 = ethers.zeroPadValue(
    ethers.toBeHex(Number(challenge)),
    32
  );
  const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));

  return {
    ok: true,
    proof,
    challengeBytes32,
    didHash,
    // Contract address and ABI will be used by Wagmi on client side
  };
}
