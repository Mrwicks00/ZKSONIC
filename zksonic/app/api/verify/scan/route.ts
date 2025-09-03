// Node.js runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/redis-sessions";
import { createWalletClient, http, parseAbi, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
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

      // Submit verification directly (no HTTP call needed)
      const submitResult = await submitVerificationToBlockchain({
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

// AgeGate ABI - Exact match to deployed contract
const AgeGateABI = parseAbi([
  "function verifyAge(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[5] calldata input, bytes32 challenge, bytes32 subjectDidHash) external returns (bool)",
]);

interface VerificationSubmission {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[];
  challengeBytes32: string;
  didHash: string;
}

async function submitVerificationToBlockchain(params: VerificationSubmission) {
  const { a, b, c, input, challengeBytes32, didHash } = params;

  console.log("Submitting verification to blockchain");

  // Get private key from environment
  let privateKey = process.env.SONIC_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("SONIC_PRIVATE_KEY not found in environment variables");
  }

  // Ensure private key has 0x prefix
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

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

  // Create wallet client
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: sonicTestnet,
    transport: http(),
  });

  console.log("Wallet client created for address:", account.address);
  console.log(
    "Contract address:",
    process.env.AGEGATE_ADDRESS || "0xcBFb34c4BF995448262C7A7eb3D1Ae5Eb2Fd4342"
  );
  console.log("Challenge bytes32:", challengeBytes32);
  console.log("DID hash:", didHash);
  console.log("Input array:", input);
  console.log("Submitting transaction...");

  // Check account balance first
  const balance = await walletClient.getBalance({ address: account.address });
  console.log("Account balance:", balance.toString(), "wei");

  // Submit the verification transaction
  const hash = await walletClient.writeContract({
    address: (process.env.AGEGATE_ADDRESS ||
      "0xcBFb34c4BF995448262C7A7eb3D1Ae5Eb2Fd4342") as `0x${string}`,
    abi: AgeGateABI,
    functionName: "verifyAge",
    args: [
      a,
      b,
      c,
      input,
      challengeBytes32 as `0x${string}`,
      didHash as `0x${string}`,
    ],
  });

  console.log("Transaction submitted:", hash);

  // Wait for transaction receipt
  const receipt = await walletClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "success") {
    console.log("Verification successful, transaction confirmed");

    return {
      success: true,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
      message: "Age verification submitted successfully to blockchain",
    };
  } else {
    throw new Error("Transaction failed");
  }
}
