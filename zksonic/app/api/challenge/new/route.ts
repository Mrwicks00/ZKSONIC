// app/api/challenge/new/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const challenge = Math.floor(Math.random() * 1e9); // uint
    
    // Get credential data from request body
    const body = await request.json();
    const { credential } = body;
    
    if (!credential) {
      return NextResponse.json(
        { error: "Credential data is required" },
        { status: 400 }
      );
    }
    
    // Include credential data in QR payload
    const qrData = JSON.stringify({ 
      t: "age18", 
      challenge,
      credential: {
        id: credential.id,
        type: credential.type,
        subjectDid: credential.subjectDid,
        issuer: credential.issuer,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
        birthYear: credential.birthYear,
        birthMonth: credential.birthMonth,
        birthDay: credential.birthDay,
        hash: credential.hash
      }
    });
    
    return NextResponse.json({ challenge, qrData, expiresInSec: 180 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate challenge" },
      { status: 500 }
    );
  }
}
