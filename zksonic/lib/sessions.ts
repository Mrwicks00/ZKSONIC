// lib/sessions.ts
// In-memory storage for verification sessions
// In production, use a database like Redis or PostgreSQL

export interface VerificationSession {
  challenge: number;
  credential: any;
  status: 'pending' | 'processing' | 'success' | 'failed';
  userDid?: string;
  result?: any;
  error?: string;
  createdAt: number;
  scannedAt?: number;
  completedAt?: number;
  expiresAt: number;
}

export const verificationSessions = new Map<string, VerificationSession>();

// Cleanup expired sessions
export const cleanupExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of verificationSessions.entries()) {
    if (now > session.expiresAt) {
      verificationSessions.delete(sessionId);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
