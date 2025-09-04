import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import * as fs from "fs";
import * as path from "path";

const WASM = "public/age_proof_js/age_proof.wasm";
const ZKEY = "public/age_proof_0001.zkey";

// AgeGate ABI
const AGEGATE_ABI = [
  "function verifyAge(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[5] calldata input, bytes32 challenge, bytes32 subjectDidHash) external returns (bool)",
];

// Groth16Verifier ABI
const VERIFIER_ABI = [
  "function verifyProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[5] memory input) external view returns (bool)",
];

function toBytes32FromNumber(n: number): string {
  const hex = ethers.toBeHex(n);
  return ethers.zeroPadValue(hex, 32);
}

function subjectDidHash(did: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(did));
}

async function prove(inputs: any) {
  console.log("Generating proof with inputs:", inputs);
  const { proof, publicSignals } = await groth16.fullProve(inputs, WASM, ZKEY);
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
  const argv = JSON.parse("[" + calldata + "]");

  const a: [string, string] = [argv[0][0], argv[0][1]];
  const b: [[string, string], [string, string]] = [
    [argv[1][0][0], argv[1][0][1]],
    [argv[1][1][0], argv[1][1][1]],
  ];
  const c: [string, string] = [argv[2][0], argv[2][1]];
  const input: string[] = argv[3];

  console.log("Proof components:", { a, b, c, input });
  console.log("Public signals:", publicSignals);
  return { a, b, c, input, publicSignals };
}

async function main() {
  console.log("=== Debug Contract Logic ===");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Use the latest deployed contracts
  const latestDeployment = JSON.parse(
    fs.readFileSync(
      "deployments/sonicTestnet-2025-09-03T23-35-48-884Z.json",
      "utf8"
    )
  );

  const ageGate = new ethers.Contract(
    latestDeployment.AgeGate,
    AGEGATE_ABI,
    signer
  );
  const verifier = new ethers.Contract(
    latestDeployment.Groth16Verifier,
    VERIFIER_ABI,
    signer
  );

  console.log("AgeGate address:", latestDeployment.AgeGate);
  console.log("Verifier address:", latestDeployment.Groth16Verifier);

  // Test case: Adult (should pass)
  const challenge = 12345;
  const did = "did:zksonic:demo-alice";

  const { a, b, c, input, publicSignals } = await prove({
    birthYear: 2000,
    birthMonth: 1,
    birthDay: 1,
    currentYear: 2025,
    currentMonth: 9,
    currentDay: 1,
    challenge,
  });

  const challengeBytes32 = toBytes32FromNumber(challenge);
  const didHash = subjectDidHash(did);

  console.log("\n=== Debug Information ===");
  console.log("Public signals:", publicSignals);
  console.log("Input array:", input);
  console.log("Challenge bytes32:", challengeBytes32);
  console.log("DID hash:", didHash);

  // Debug each input element
  console.log("\n=== Input Array Analysis ===");
  for (let i = 0; i < input.length; i++) {
    const value = BigInt(input[i]);
    console.log(`input[${i}]: ${input[i]} (${value})`);
  }

  // Test verifier directly
  console.log("\n=== Testing Verifier Directly ===");
  try {
    const verifierResult = await verifier.verifyProof(a, b, c, input);
    console.log("Verifier result:", verifierResult);
  } catch (error) {
    console.error("Verifier error:", error);
  }

  // Test AgeGate with static call first
  console.log("\n=== Testing AgeGate with Static Call ===");
  try {
    const staticResult = await ageGate.verifyAge.staticCall(
      a,
      b,
      c,
      input,
      challengeBytes32,
      didHash
    );
    console.log("AgeGate static call result:", staticResult);
  } catch (error) {
    console.error("AgeGate static call error:", error);
  }

  // Test AgeGate with actual transaction
  console.log("\n=== Testing AgeGate with Transaction ===");
  try {
    const tx = await ageGate.verifyAge(
      a,
      b,
      c,
      input,
      challengeBytes32,
      didHash
    );
    const receipt = await tx.wait();
    console.log("Transaction executed, gas used:", receipt.gasUsed);

    // Parse the event
    const iface = new ethers.Interface([
      "event AgeVerified(address indexed caller, bytes32 indexed challenge, bytes32 indexed subjectDidHash, bool isOver18)",
    ]);

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "AgeVerified") {
          console.log("AgeVerified event:", {
            caller: parsed.args.caller,
            challenge: parsed.args.challenge,
            subjectDidHash: parsed.args.subjectDidHash,
            isOver18: parsed.args.isOver18,
          });
        }
      } catch (error) {
        // Not our event
      }
    }
  } catch (error) {
    console.error("AgeGate transaction error:", error);
  }
}

main()
  .then(() => {
    console.log("\n=== Debug completed ===");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
