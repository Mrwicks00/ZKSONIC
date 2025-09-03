// Node.js runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/redis-sessions";
import { generateProofUtil, verifyProofUtil } from "@/lib/proof-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userDid } = body;

    console.log(
      `Processing scan for session: ${sessionId}, userDid: ${userDid}`
    );

    if (!sessionId || !userDid) {
      return NextResponse.json(
        { error: "Session ID and user DID are required" },
        { status: 400 }
      );
    }

    // Get session from persistent storage
    const session = await getSession(sessionId);
    console.log(`Session found:`, !!session);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      return NextResponse.json({ error: "Session expired" }, { status: 410 });
    }

    // Check if already processing/completed
    if (session.status !== "pending") {
      return NextResponse.json({
        success: session.status === "success",
        status: session.status,
        result: session.result,
        error: session.error,
        sessionId,
      });
    }

    // Update session status
    await updateSession(sessionId, {
      userDid,
      status: "processing",
      scannedAt: Date.now(),
    });

    // Process verification on server side
    try {
      // Get the proof from the request body (generated on client)
      const { proof } = body;

      if (!proof) {
        return NextResponse.json(
          { error: "Proof is required" },
          { status: 400 }
        );
      }

      console.log("Received client-generated proof, submitting to blockchain...");

      // Submit the verification transaction to the blockchain
      const submitResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/submit-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          a: proof.a,
          b: proof.b,
          c: proof.c,
          input: proof.input,
          challengeBytes32: proof.challengeBytes32,
          didHash: proof.didHash,
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        throw new Error(`Blockchain submission failed: ${errorData.error || 'Unknown error'}`);
      }

      const submitResult = await submitResponse.json();
      console.log("Verification submitted successfully:", submitResult);

      // Update session with success
      await updateSession(sessionId, {
        status: "success",
        result: submitResult,
        completedAt: Date.now(),
      });

      const response = NextResponse.json({
        success: true,
        status: "success",
        result: submitResult,
        sessionId,
      });

      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS"
      );
      return response;
    } catch (error: any) {
      console.error("Verification error:", error);

      await updateSession(sessionId, {
        status: "failed",
        error: error?.message || "Unknown error",
        completedAt: Date.now(),
      });

      const response = NextResponse.json({
        success: false,
        status: "failed",
        error: error?.message || "Unknown error",
        sessionId,
      });

      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS"
      );
      return response;
    }
  } catch (error: any) {
    console.error("Scan processing error:", error);
    const response = NextResponse.json(
      { error: error?.message || "Failed to process verification" },
      { status: 500 }
    );

    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    return response;
  }
}
