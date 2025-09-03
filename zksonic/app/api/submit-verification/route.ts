// Node.js runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sonicTestnet } from "viem/chains";

// AgeGate ABI - Fixed parameter types to match contract
const AgeGateABI = parseAbi([
  "function verifyAge(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[5] input, bytes32 challenge, bytes32 didHash) external returns (bool)",
]);

interface VerificationSubmission {
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
    input: bigint[];
  };
  challengeBytes32: string;
  didHash: string;
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerificationSubmission = await request.json();
    const { proof, challengeBytes32, didHash, sessionId } = body;

    console.log(
      "Submitting verification to blockchain for session:",
      sessionId
    );

    // Get private key from environment
    let privateKey = process.env.SONIC_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("SONIC_PRIVATE_KEY not found in environment variables");
    }

    // Ensure private key has 0x prefix
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }

    // Create wallet client
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: sonicTestnet,
      transport: http(),
    });

    console.log("Wallet client created, submitting transaction...");

    // Submit the verification transaction
    const hash = await walletClient.writeContract({
      address: "0xcBFb34c4BF995448262C7A7eb3D1Ae5Eb2Fd4342" as `0x${string}`, // AgeGate contract address
      abi: AgeGateABI,
      functionName: "verifyAge",
      args: [
        proof.a,
        proof.b,
        proof.c,
        proof.input,
        challengeBytes32 as `0x${string}`,
        didHash as `0x${string}`,
      ],
    });

    console.log("Transaction submitted:", hash);

    // Wait for transaction receipt
    const receipt = await walletClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("Verification successful, transaction confirmed");

      return NextResponse.json({
        success: true,
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
        message: "Age verification submitted successfully to blockchain",
      });
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error: any) {
    console.error("Blockchain submission error:", error);
    return NextResponse.json(
      {
        error: "Failed to submit verification to blockchain",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
