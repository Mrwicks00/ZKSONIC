// lib/sessions.ts
// In-memory storage for verification sessions
// In production, use a database like Redis or PostgreSQL

export interface VerificationSession {
  challenge: number;
  credential: any;
  status: "pending" | "processing" | "success" | "failed";
  userDid?: string;
  result?: any;
  error?: string;
  createdAt: number;
  scannedAt?: number;
  completedAt?: number;
  expiresAt: number;
}

// Global singleton to ensure same instance across all API routes
declare global {
  var __verificationSessions: Map<string, VerificationSession> | undefined;
  var __cleanupInterval: NodeJS.Timeout | undefined;
}

// Use global variable to persist across Next.js hot reloads and API route instances
export const verificationSessions = (globalThis.__verificationSessions ??=
  new Map<string, VerificationSession>());

// Cleanup expired sessions
export const cleanupExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of verificationSessions.entries()) {
    if (now > session.expiresAt) {
      verificationSessions.delete(sessionId);
    }
  }
};

// Run cleanup every 5 minutes (only once globally)
if (!globalThis.__cleanupInterval) {
  globalThis.__cleanupInterval = setInterval(
    cleanupExpiredSessions,
    5 * 60 * 1000
  );
}
