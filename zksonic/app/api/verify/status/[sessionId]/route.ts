// app/api/verify/status/[sessionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verificationSessions } from "@/lib/sessions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get session data
    const session = verificationSessions.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      verificationSessions.delete(sessionId);
      return NextResponse.json({ error: "Session expired" }, { status: 410 });
    }

    return NextResponse.json({
      sessionId,
      status: session.status,
      challenge: session.challenge,
      userDid: session.userDid,
      result: session.result,
      error: session.error,
      createdAt: session.createdAt,
      scannedAt: session.scannedAt,
      completedAt: session.completedAt,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get session status" },
      { status: 500 }
    );
  }
}
