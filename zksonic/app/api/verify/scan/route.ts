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
      console.log("Generating proof...");
      const proof = await Promise.race([
        generateProofUtil(session.credential, session.challenge),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Proof generation timeout")), 30000)
        ),
      ]);

      console.log("Verifying proof...");
      const verifyResult = await Promise.race([
        verifyProofUtil(proof, session.challenge, userDid),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Verification timeout")), 45000)
        ),
      ]);

      // Update session with final result
      await updateSession(sessionId, {
        status: (verifyResult as any).ok ? "success" : "failed",
        result: verifyResult,
        error: !(verifyResult as any).ok ? "Verification failed" : undefined,
        completedAt: Date.now(),
      });

      const response = NextResponse.json({
        success: (verifyResult as any).ok,
        status: (verifyResult as any).ok ? "success" : "failed",
        result: verifyResult,
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
