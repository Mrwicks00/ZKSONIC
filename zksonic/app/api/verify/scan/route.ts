// app/api/verify/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verificationSessions } from "@/lib/sessions";
import { generateProofUtil, verifyProofUtil } from "@/lib/proof-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userDid } = body;

    if (!sessionId || !userDid) {
      return NextResponse.json(
        { error: "Session ID and user DID are required" },
        { status: 400 }
      );
    }

    // Get session data
    const session = verificationSessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      verificationSessions.delete(sessionId);
      return NextResponse.json({ error: "Session expired" }, { status: 410 });
    }

    // Update session with user DID
    session.userDid = userDid;
    session.status = "processing";
    session.scannedAt = Date.now();

    // Process verification on server side
    try {
      // Generate proof using stored credential with timeout
      const proof = await Promise.race([
        generateProofUtil(session.credential, session.challenge),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Proof generation timeout")), 30000)
        ),
      ]) as any;

      // Verify on chain with timeout
      const verifyResult = await Promise.race([
        verifyProofUtil(proof, session.challenge, userDid),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Verification timeout")), 45000)
        ),
      ]) as any;

      // Update session with result
      session.status = verifyResult.ok ? "success" : "failed";
      session.result = verifyResult;
      session.completedAt = Date.now();

      return NextResponse.json({
        success: true,
        status: session.status,
        result: verifyResult,
        sessionId,
      });
    } catch (error: any) {
      session.status = "failed";
      session.error = error?.message || "Unknown error";
      session.completedAt = Date.now();

      return NextResponse.json({
        success: false,
        status: "failed",
        error: error?.message || "Unknown error",
        sessionId,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to process verification" },
      { status: 500 }
    );
  }
}
