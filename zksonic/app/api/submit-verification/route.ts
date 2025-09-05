// Node.js runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  parseAbi,
  defineChain,
  createPublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ADDRESSES } from "@/lib/addresses";
import { Groth16VerifierABI } from "@/lib/abi/Groth16Verifier";

// Groth16Verifier ABI - Direct verification
const Groth16VerifierABI_parsed = parseAbi([
  "function verifyProof(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[5] calldata input) external view returns (bool)",
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

    // Create public client for balance checking and receipt waiting
    const publicClient = createPublicClient({
      chain: sonicTestnet,
      transport: http(),
    });

    console.log("Public client created for address:", account.address);
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
      abi: Groth16VerifierABI_parsed,
      functionName: "verifyProof",
      args: [aBigInt, bBigInt, cBigInt, inputBigInt],
    });

    console.log("Groth16Verifier result:", proofValid);

    // Check if person is over 18 (input[0] should be 1)
    const isOver18 = inputBigInt[0] === BigInt(1);
    const finalResult = proofValid && isOver18;

    console.log("isOver18 from input[0]:", isOver18);
    console.log("Final verification result:", finalResult);

    if (finalResult) {
      console.log("Verification successful - User is over 18");

      return NextResponse.json({
        success: true,
        isOver18: true,
        proofValid: proofValid,
        message: "Age verification successful - User is over 18",
      });
    } else {
      console.log("Verification failed - User is under 18");

      return NextResponse.json({
        success: true,
        isOver18: false,
        proofValid: proofValid,
        message: "Age verification failed - User is under 18",
      });
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
