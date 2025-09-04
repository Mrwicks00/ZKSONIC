import { ethers } from "hardhat";
import { groth16 } from "snarkjs";
import * as fs from "fs";

const WASM = "public/age_proof_js/age_proof.wasm";
const ZKEY = "public/age_proof_0001.zkey";

// TestAgeGate ABI
const TEST_ABI = [
  "function testLogic(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[5] calldata input, bytes32 challenge, bytes32 subjectDidHash) external returns (bool)",
  "event TestResult(bool verifierResult, bool over18, bool finalResult, uint input0, uint input4, uint challenge)",
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
  console.log("=== Testing Simple Contract ===");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Deploy TestAgeGate
  const TestAgeGate = await ethers.getContractFactory("TestAgeGate");
  const latestDeployment = JSON.parse(
    fs.readFileSync(
      "deployments/sonicTestnet-2025-09-03T23-35-48-884Z.json",
      "utf8"
    )
  );

  const testContract = await TestAgeGate.deploy(
    latestDeployment.Groth16Verifier
  );
  await testContract.waitForDeployment();
  const testAddress = await testContract.getAddress();
  console.log("TestAgeGate deployed at:", testAddress);

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

  console.log("\n=== Test Information ===");
  console.log("Public signals:", publicSignals);
  console.log("Input array:", input);
  console.log("Challenge bytes32:", challengeBytes32);

  // Test the simple contract
  console.log("\n=== Testing Simple Contract ===");
  try {
    const tx = await testContract.testLogic(
      a,
      b,
      c,
      input,
      challengeBytes32,
      didHash
    );
    const receipt = await tx.wait();
    console.log("Transaction executed, gas used:", receipt.gasUsed);

    // Parse the TestResult event
    const iface = new ethers.Interface(TEST_ABI);

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "TestResult") {
          console.log("TestResult event:", {
            verifierResult: parsed.args.verifierResult,
            over18: parsed.args.over18,
            finalResult: parsed.args.finalResult,
            input0: parsed.args.input0.toString(),
            input4: parsed.args.input4.toString(),
            challenge: parsed.args.challenge.toString(),
          });
        }
      } catch (error) {
        // Not our event
      }
    }
  } catch (error) {
    console.error("Test contract error:", error);
  }
}

main()
  .then(() => {
    console.log("\n=== Test completed ===");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });

