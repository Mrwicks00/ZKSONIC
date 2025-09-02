// app/api/challenge/new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verificationSessions } from "@/lib/sessions";

export async function POST(request: NextRequest) {
  try {
    const challenge = Math.floor(Math.random() * 1e9); // uint
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Get credential data from request body
    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json(
        { error: "Credential data is required" },
        { status: 400 }
      );
    }

    // Store session data (credential + challenge)
    verificationSessions.set(sessionId, {
      challenge,
      credential,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 180 * 1000, // 3 minutes
    });

    // QR only contains challenge and session ID
    const qrData = JSON.stringify({
      t: "age18",
      challenge,
      sessionId,
    });

    return NextResponse.json({
      challenge,
      sessionId,
      qrData,
      expiresInSec: 180,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate challenge" },
      { status: 500 }
    );
  }
}

// Sessions are now imported from @/lib/sessions
