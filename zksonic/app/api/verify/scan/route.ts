// Node.js runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/redis-sessions";
import { createPublicClient, http, parseAbi, defineChain } from "viem";
import { ADDRESSES } from "@/lib/addresses";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userDid } = body;

    console.log(
      `Processing scan for session: ${sessionId}, userDid: ${userDid}`
    );

    if (!sessionId || !userDid) {
      return NextResponse.json(
        { error: "Session ID and user DID are required" },
        { status: 400 }
      );
    }

    // Get session from persistent storage
    const session = await getSession(sessionId);
    console.log(`Session found:`, !!session);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      return NextResponse.json({ error: "Session expired" }, { status: 410 });
    }

    // Check if already processing/completed
    if (session.status !== "pending") {
      return NextResponse.json({
        success: session.status === "success",
        status: session.status,
        result: session.result,
        error: session.error,
        sessionId,
      });
    }

    // Update session status
    await updateSession(sessionId, {
      userDid,
      status: "processing",
      scannedAt: Date.now(),
    });

    // Process verification on server side
    try {
      // Get the proof from the request body (generated on client)
      const { proof } = body;

      if (!proof) {
        return NextResponse.json(
          { error: "Proof is required" },
          { status: 400 }
        );
      }

      console.log(
        "Received client-generated proof, submitting to blockchain..."
      );

      // Use direct Groth16Verifier verification (bypass AgeGate)
      const submitResult = await verifyWithGroth16Direct({
        a: proof.a,
        b: proof.b,
        c: proof.c,
        input: proof.input,
        challengeBytes32: proof.challengeBytes32,
        didHash: proof.didHash,
      });

      console.log("Verification submitted successfully:", submitResult);

      // Update session with success
      await updateSession(sessionId, {
        status: "success",
        result: submitResult,
        completedAt: Date.now(),
      });

      const response = NextResponse.json({
        success: true,
        status: "success",
        result: submitResult,
        sessionId,
      });

      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS"
      );
      return response;
    } catch (error: any) {
      console.error("Verification error:", error);

      await updateSession(sessionId, {
        status: "failed",
        error: error?.message || "Unknown error",
        completedAt: Date.now(),
      });

      const response = NextResponse.json({
        success: false,
        status: "failed",
        error: error?.message || "Unknown error",
        sessionId,
      });

      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS"
      );
      return response;
    }
  } catch (error: any) {
    console.error("Scan processing error:", error);
    const response = NextResponse.json(
      { error: error?.message || "Failed to process verification" },
      { status: 500 }
    );

    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    return response;
  }
}

// Groth16Verifier ABI - Direct verification
const Groth16VerifierABI = parseAbi([
  "function verifyProof(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[5] calldata input) external view returns (bool)",
]);

interface VerificationSubmission {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[];
  challengeBytes32: string;
  didHash: string;
}

async function verifyWithGroth16Direct(params: VerificationSubmission) {
  const { a, b, c, input } = params;

  console.log("Verifying with Groth16Verifier directly");

  // Create custom chain configuration (matching our addresses.ts)
  const sonicTestnet = defineChain({
    id: ADDRESSES.sonicTestnet.chainId,
    name: "Sonic Testnet",
    nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
    rpcUrls: {
      default: { http: [ADDRESSES.sonicTestnet.rpcUrl] },
      public: { http: [ADDRESSES.sonicTestnet.rpcUrl] },
    },
    blockExplorers: {
      default: { name: "SonicScan", url: "https://testnet.sonicscan.org" },
    },
    testnet: true,
  });

  // Create public client for verification
  const publicClient = createPublicClient({
    chain: sonicTestnet,
    transport: http(),
  });

  console.log(
    "Groth16Verifier address:",
    ADDRESSES.sonicTestnet.Groth16Verifier
  );
  console.log("Input array:", input);
  console.log("Verifying proof directly...");

  // Convert string arrays to bigint arrays for Groth16Verifier
  const aBigInt: [bigint, bigint] = [BigInt(a[0]), BigInt(a[1])];
  const bBigInt: [[bigint, bigint], [bigint, bigint]] = [
    [BigInt(b[0][0]), BigInt(b[0][1])],
    [BigInt(b[1][0]), BigInt(b[1][1])],
  ];
  const cBigInt: [bigint, bigint] = [BigInt(c[0]), BigInt(c[1])];
  const inputBigInt: [bigint, bigint, bigint, bigint, bigint] = [
    BigInt(input[0]),
    BigInt(input[1]),
    BigInt(input[2]),
    BigInt(input[3]),
    BigInt(input[4]),
  ];

  // Direct Groth16Verifier verification (no transaction needed)
  const proofValid = await publicClient.readContract({
    address: ADDRESSES.sonicTestnet.Groth16Verifier as `0x${string}`,
    abi: Groth16VerifierABI,
    functionName: "verifyProof",
    args: [aBigInt, bBigInt, cBigInt, inputBigInt],
  });

  console.log("Groth16Verifier result:", proofValid);

  // Check if person is over 18 (input[0] should be 1 - matching smokeVerify)
  const isOver18 = inputBigInt[0] === BigInt(1);
  const finalResult = proofValid && isOver18;

  console.log("isOver18 from input[0]:", isOver18);
  console.log("Final verification result:", finalResult);

  if (finalResult) {
    console.log("Verification successful - User is over 18");
    return {
      success: true,
      isOver18: true,
      proofValid: proofValid,
      message: "Age verification successful - User is over 18",
    };
  } else {
    console.log("Verification failed - User is under 18");
    return {
      success: true,
      isOver18: false,
      proofValid: proofValid,
      message: "Age verification failed - User is under 18",
    };
  }
}
