import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { groth16 } from "snarkjs";

// ==== CHANGE THESE IF YOUR LAYOUT DIFFERS ====
const DEPLOYMENTS_JSON = "deployments/sonicTestnet-*.json"; // we'll auto-pick the latest
const WASM = "public/age_proof_js/age_proof.wasm";
const ZKEY = "public/age_proof_0001.zkey";

// AgeGate ABI (properly formatted with correct types)
const AGEGATE_ABI = [
  "function verifyAge(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[5] calldata input, bytes32 challenge, bytes32 subjectDidHash) external returns (bool)",
];

// Verifier ABI (properly formatted)
const VERIFIER_ABI = [
  "function verifyProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[5] memory input) external view returns (bool)",
];

function latestDeploymentFile(): string {
  const dir = "deployments";
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("sonicTestnet-") && f.endsWith(".json"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
  if (files.length === 0)
    throw new Error("No sonicTestnet deployments JSON found");
  return files[files.length - 1];
}

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
  // calldata is a string like: "[[a0,a1],[[b00,b01],[b10,b11]],[c0,c1],[...publicSignals]]"
  const argv = JSON.parse("[" + calldata + "]");

  // Convert to proper format for ethers
  const a: [string, string] = [argv[0][0], argv[0][1]];
  const b: [[string, string], [string, string]] = [
    [argv[1][0][0], argv[1][0][1]],
    [argv[1][1][0], argv[1][1][1]],
  ];
  const c: [string, string] = [argv[2][0], argv[2][1]];
  const input: string[] = argv[3];

  console.log("Proof components:", { a, b, c, input });
  return { a, b, c, input, publicSignals };
}

async function runCase(
  label: string,
  contracts: { ageGate: string; verifier: string },
  proofInputs: any,
  challengeNum: number,
  did: string
) {
  console.log(`\n=== ${label} ===`);

  try {
    const { a, b, c, input, publicSignals } = await prove(proofInputs);

    // sanity: last publicSignals element should be isOver18 (1/0)

    const isOver18 = publicSignals[0];
    console.log("publicSignals:", publicSignals, "=> isOver18 =", isOver18);

    // Connect contracts
    const signer = (await ethers.getSigners())[0];
    const ageGate = new ethers.Contract(contracts.ageGate, AGEGATE_ABI, signer);
    const verifier = new ethers.Contract(
      contracts.verifier,
      VERIFIER_ABI,
      signer
    );

    // Prepare extra params for AgeGate
    const challenge = toBytes32FromNumber(challengeNum); // must match input[3]
    const didHash = subjectDidHash(did);

    console.log("Challenge bytes32:", challenge);
    console.log("DID hash:", didHash);
    console.log("Input array length:", input.length);

    // Raw verifier (view) - test first
    try {
      const okRaw: boolean = await verifier.verifyProof(a, b, c, input);
      console.log(
        "Groth16Verifier.verifyProof:",
        okRaw ? "✅ valid" : "❌ invalid"
      );
    } catch (error) {
      console.error("Error calling verifyProof:", error);
      return;
    }

    // AgeGate wrapper (returns bool, does extra checks and emits event)
    try {
      // First, simulate the call to get the result
      const okGate: boolean = await ageGate.verifyAge.staticCall(
        a,
        b,
        c,
        input,
        challenge,
        didHash
      );
      console.log(
        "AgeGate.verifyAge (staticCall):",
        okGate ? "✅ PASS (over 18)" : "❌ FAIL (under 18)"
      );

      // If you want to actually execute the transaction (not just simulate):
      const tx = await ageGate.verifyAge(a, b, c, input, challenge, didHash);
      const receipt = await tx.wait();
      console.log("Transaction executed, gas used:", receipt.gasUsed);
    } catch (error) {
      console.error("Error calling AgeGate.verifyAge:", error);
    }
  } catch (error) {
    console.error(`Error in ${label}:`, error);
  }
}

async function main() {
  console.log("Network:", network.name);

  const file = latestDeploymentFile();
  const deployed = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log("Using deployments:", deployed);

  const contracts = {
    ageGate: deployed.AgeGate as string,
    verifier: deployed.Groth16Verifier as string,
  };

  // Public inputs order must be: currentYear, currentMonth, currentDay, challenge, isOver18 (output)
  // We set 'challenge' as a small integer and pass the same to AgeGate as bytes32
  const challenge = 12345;

  // === Adult case (should PASS) ===
  await runCase(
    "Adult (should PASS)",
    contracts,
    {
      birthYear: 2000,
      birthMonth: 1,
      birthDay: 1,
      currentYear: 2025,
      currentMonth: 9,
      currentDay: 1,
      challenge,
    },
    challenge,
    "did:zksonic:demo-alice"
  );

  // === Minor case (should FAIL) ===
  await runCase(
    "Minor (should FAIL)",
    contracts,
    {
      birthYear: 2010,
      birthMonth: 1,
      birthDay: 1,
      currentYear: 2025,
      currentMonth: 9,
      currentDay: 1,
      challenge,
    },
    challenge,
    "did:zksonic:demo-bob"
  );
}

main()
  .then(() => {
    console.log("\n=== Script completed successfully ===");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
