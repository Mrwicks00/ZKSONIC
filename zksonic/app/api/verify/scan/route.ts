// app/api/verify/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verificationSessions } from "@/lib/sessions";

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
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

      // Generate proof using stored credential with timeout
      const proofResponse = (await Promise.race([
        fetch(`${baseUrl}/api/generate-proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential: session.credential,
            challenge: session.challenge,
          }),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Proof generation timeout")), 30000)
        ),
      ])) as Response;

      if (!proofResponse.ok) {
        const errorText = await proofResponse.text();
        throw new Error(`Failed to generate proof: ${errorText}`);
      }

      const proof = await proofResponse.json();

      // Verify on chain with timeout
      const verifyResponse = (await Promise.race([
        fetch(`${baseUrl}/api/verify-proof`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            a: proof.a,
            b: proof.b,
            c: proof.c,
            input: proof.input,
            challenge: session.challenge,
            did: userDid,
          }),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Verification timeout")), 45000)
        ),
      ])) as Response;

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        throw new Error(`Failed to verify proof: ${errorText}`);
      }

      const verifyResult = await verifyResponse.json();

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
