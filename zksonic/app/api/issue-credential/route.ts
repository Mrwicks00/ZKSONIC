// app/api/issue-credential/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ethers } from "ethers";

const schema = z.object({
  subjectDid: z.string().min(8),
  birthYear: z.number().int().min(1900).max(2100),
  birthMonth: z.number().int().min(1).max(12),
  birthDay: z.number().int().min(1).max(31)
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = schema.parse(body);

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(new Date().setFullYear(new Date().getFullYear()+1)).toISOString();

    const credential = {
      type: "AgeCredential",
      subjectDid: input.subjectDid,
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
      birthDay: input.birthDay,
      issuer: "did:zksonic:demo-issuer",
      issuedAt,
      expiresAt
    };

    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(credential)));
    return NextResponse.json({ credential, credentialHash });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
