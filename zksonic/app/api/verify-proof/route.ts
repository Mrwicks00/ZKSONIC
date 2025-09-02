// app/api/verify-proof/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { ADDRESSES } from "@/lib/addresses";
import { AgeGateABI } from "@/lib/abi/AgeGate";

const N = ADDRESSES.sonicTestnet;

export async function POST(req: NextRequest) {
  try {
    const { a, b, c, input, challengeNumber, did } = await req.json();

    const provider = new ethers.JsonRpcProvider(N.rpcUrl);
    const wallet = new ethers.Wallet(process.env.SONIC_PRIVATE_KEY!, provider);
    const ageGate = new ethers.Contract(N.AgeGate, AgeGateABI, wallet);

    const challengeBytes32 = ethers.zeroPadValue(ethers.toBeHex(Number(challengeNumber)), 32);
    const didHash = ethers.keccak256(ethers.toUtf8Bytes(did));

    // simulate first
    const ok = await ageGate.verifyAge.staticCall(a, b, c, input, challengeBytes32, didHash);

    // send tx so you get an on-chain event for demos (uncomment if you want actual tx)
    // const tx = await ageGate.verifyAge(a, b, c, input, challengeBytes32, didHash);
    // const rc = await tx.wait();

    return NextResponse.json({ ok /*, txHash: rc?.hash*/ });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
