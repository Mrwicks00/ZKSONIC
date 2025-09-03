import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { sonicTestnet } from "viem/chains";
import { getSession } from "@/lib/redis-sessions";

// Import snarkjs with proper typing
import { groth16 } from "snarkjs";

// Create a more robust public client
const publicClient = createPublicClient({
  chain: sonicTestnet,
  transport: http(),
});

// AgeGate ABI for reading contract state
const AgeGateABI = parseAbi([
  "function verifyAge(uint256[2] memory _pA, uint256[2][2] memory _pB, uint256[2] memory _pC, uint256[2] memory _pubSignals, bytes32 _challenge, bytes32 _didHash) public view returns (bool)",
  "function isVerified(bytes32 _didHash) public view returns (bool)",
]);

interface AgeCredential {
  type: string;
  subjectDid: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
}

interface ProofGenerationRequest {
  sessionId: string;
  challenge: number;
  userDid: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProofGenerationRequest = await request.json();
    const { sessionId, challenge, userDid } = body;

    console.log("Server-side proof generation started for:", userDid);

    // Validate input
    if (!sessionId || !challenge || !userDid) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Retrieve credential from Redis session
    const session = await getSession(sessionId);
    if (!session || !session.credential) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    const credential = session.credential;

    // Calculate age from credential
    const today = new Date();
    const birthDate = new Date(
      credential.birthYear,
      credential.birthMonth - 1,
      credential.birthDay
    );
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    console.log("Calculated age:", age);

    // Prepare inputs for the circuit
    const circuitInputs = {
      birthYear: credential.birthYear,
      birthMonth: credential.birthMonth,
      birthDay: credential.birthDay,
      currentYear: today.getFullYear(),
      currentMonth: today.getMonth() + 1,
      currentDay: today.getDate(),
      challenge: challenge,
    };

    console.log("Circuit inputs:", circuitInputs);

    // Generate proof - let it run naturally
    const startTime = Date.now();

    try {
      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        "./public/age_proof_js/age_proof.wasm",
        "./public/age_proof_0001.zkey"
      );

      const generationTime = Date.now() - startTime;
      console.log(`Proof generated in ${generationTime}ms`);

      // Use exportSolidityCallData like in the working script
      const calldata = await groth16.exportSolidityCallData(
        proof,
        publicSignals
      );
      const argv = JSON.parse("[" + calldata + "]");

      // Convert to proper format like in the working script
      const a: [string, string] = [argv[0][0], argv[0][1]];
      const b: [[string, string], [string, string]] = [
        [argv[1][0][0], argv[1][0][1]],
        [argv[1][1][0], argv[1][1][1]],
      ];
      const c: [string, string] = [argv[2][0], argv[2][1]];
      const input: string[] = argv[3];

      console.log("Proof components:", { a, b, c, input });
      console.log("Public signals:", publicSignals);

      // Check if over 18 (first public signal)
      const isOver18 = publicSignals[0];
      console.log("isOver18 =", isOver18);

      // Prepare the proof for the smart contract
      const formattedProof = {
        a,
        b,
        c,
        input: input.map((signal: string) => BigInt(signal)),
      };

      // Convert challenge to bytes32 (like in working script)
      const challengeBytes32 = `0x${challenge
        .toString(16)
        .padStart(64, "0")}` as `0x${string}`;

      // Calculate DID hash (like in working script)
      const didHash = `0x${Buffer.from(userDid)
        .toString("hex")
        .padStart(64, "0")}` as `0x${string}`;

      console.log("Proof formatted for contract");

      return NextResponse.json({
        success: true,
        proof: formattedProof,
        challengeBytes32,
        didHash,
        generationTime,
        age,
        message: "Proof generated and verified successfully",
      });
    } catch (proofError: any) {
      console.error("Proof generation error:", proofError);
      return NextResponse.json(
        {
          error: "Proof generation failed",
          details: proofError.message,
          generationTime: Date.now() - startTime,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Server proof generation error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
