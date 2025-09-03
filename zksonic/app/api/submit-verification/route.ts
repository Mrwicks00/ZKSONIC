// Node.js runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, parseAbi, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES } from "@/lib/addresses";

// AgeGate ABI - Exact match to deployed contract
const AgeGateABI = parseAbi([
  "function verifyAge(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[5] calldata input, bytes32 challenge, bytes32 subjectDidHash) external returns (bool)",
]);

interface VerificationSubmission {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[]; // This is now hex strings from exportSolidityCallData
  challengeBytes32: string;
  didHash: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerificationSubmission = await request.json();
    const { a, b, c, input, challengeBytes32, didHash } = body;

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
      process.env.AGEGATE_ADDRESS ||
        "0xcBFb34c4BF995448262C7A7eb3D1Ae5Eb2Fd4342"
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

    // Log more specific error details
    if (error.code) {
      console.error("Error code:", error.code);
    }
    if (error.shortMessage) {
      console.error("Short message:", error.shortMessage);
    }
    if (error.details) {
      console.error("Error details:", error.details);
    }

    return NextResponse.json(
      {
        error: "Failed to submit verification to blockchain",
        details: error.message || error.shortMessage || "Unknown error",
        code: error.code,
      },
      { status: 500 }
    );
  }
}
