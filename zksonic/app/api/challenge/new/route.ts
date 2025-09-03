import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/redis-sessions";

export async function POST(request: NextRequest) {
  try {
    const challenge = Math.floor(Math.random() * 1e9);
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json(
        { error: "Credential data is required" },
        { status: 400 }
      );
    }

    // Create session in persistent storage
    await createSession(sessionId, {
      challenge,
      credential,
      status: "pending",
      createdAt: Date.now(),
    });

    console.log(`Created session: ${sessionId}`);

    const qrData = JSON.stringify({
      t: "age18",
      challenge,
      sessionId,
      credential, // Include credential for client-side proof generation
    });

    return NextResponse.json({
      challenge,
      sessionId,
      qrData,
      expiresInSec: 300, // 5 minutes
    });
  } catch (error) {
    console.error("Challenge creation error:", error);
    return NextResponse.json(
      { error: "Failed to generate challenge" },
      { status: 500 }
    );
  }
}
