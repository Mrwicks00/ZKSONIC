// lib/client-proof.ts - Client-side proof generation
import { groth16 } from "snarkjs";

export interface ProofInput {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  challenge: number;
}

export interface ProofResult {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[];
}

export async function generateClientProof(
  credential: any,
  challenge: number
): Promise<ProofResult> {
  const { birthYear, birthMonth, birthDay } = credential;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();

  const input: ProofInput = {
    birthYear,
    birthMonth,
    birthDay,
    currentYear,
    currentMonth,
    currentDay,
    challenge,
  };

  console.log("Generating proof with input:", input);

  // Load WASM and ZKEY files from public directory
  const wasmResponse = await fetch("/age_proof_js/age_proof.wasm");
  const wasmBuffer = await wasmResponse.arrayBuffer();

  const zkeyResponse = await fetch("/age_proof_0001.zkey");
  const zkeyBuffer = await zkeyResponse.arrayBuffer();

  // Generate proof using snarkjs
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    wasmBuffer,
    zkeyBuffer
  );

  // Export as Solidity calldata
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
  const argv = calldata
    .replace(/["[\]\s]/g, "")
    .split(",")
    .map((x: string) => BigInt(x).toString());

  const result: ProofResult = {
    a: [argv[0], argv[1]],
    b: [
      [argv[2], argv[3]],
      [argv[4], argv[5]],
    ],
    c: [argv[6], argv[7]],
    input: argv.slice(8),
  };

  console.log("Proof generated successfully:", result);
  return result;
}
