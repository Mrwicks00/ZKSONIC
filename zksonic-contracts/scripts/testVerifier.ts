import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import * as fs from "fs";

const WASM = "public/age_proof_js/age_proof.wasm";
const ZKEY = "public/age_proof_0001.zkey";

// Groth16Verifier ABI
const VERIFIER_ABI = [
  "function verifyProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[5] memory input) external view returns (bool)",
];

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
  console.log("=== Testing Verifier Directly ===");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Use the latest deployed contracts
  const latestDeployment = JSON.parse(
    fs.readFileSync(
      "deployments/sonicTestnet-2025-09-03T23-35-48-884Z.json",
      "utf8"
    )
  );

  const verifier = new ethers.Contract(
    latestDeployment.Groth16Verifier,
    VERIFIER_ABI,
    signer
  );
  console.log("Verifier address:", latestDeployment.Groth16Verifier);

  // Test case: Adult (should pass)
  const challenge = 12345;

  const { a, b, c, input, publicSignals } = await prove({
    birthYear: 2000,
    birthMonth: 1,
    birthDay: 1,
    currentYear: 2025,
    currentMonth: 9,
    currentDay: 1,
    challenge,
  });

  console.log("\n=== Verifier Test ===");
  console.log("Public signals:", publicSignals);
  console.log("Input array:", input);

  // Test verifier directly
  try {
    const result = await verifier.verifyProof(a, b, c, input);
    console.log("Verifier result:", result);

    if (!result) {
      console.log("❌ Verifier rejected valid proof!");
      console.log(
        "This means the Groth16Verifier contract is broken or we're using the wrong one."
      );
    } else {
      console.log("✅ Verifier accepted proof");
    }
  } catch (error) {
    console.error("Verifier error:", error);
  }
}

main()
  .then(() => {
    console.log("\n=== Verifier test completed ===");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });

