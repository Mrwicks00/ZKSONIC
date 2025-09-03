import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Debug Redis connection (server-side only)
if (typeof window === "undefined") {
  console.log(
    "Redis URL:",
    process.env.UPSTASH_REDIS_REST_URL ? "Set" : "Missing"
  );
  console.log(
    "Redis Token:",
    process.env.UPSTASH_REDIS_REST_TOKEN ? "Set" : "Missing"
  );
}

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

const SESSION_PREFIX = "zkproof_session:";
const SESSION_TTL = 900; // 15 minutes

export async function createSession(
  sessionId: string,
  data: Omit<VerificationSession, "expiresAt">
) {
  const session: VerificationSession = {
    ...data,
    expiresAt: Date.now() + SESSION_TTL * 1000,
  };

  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    SESSION_TTL,
    JSON.stringify(session)
  );
  return session;
}

export async function getSession(
  sessionId: string
): Promise<VerificationSession | null> {
  try {
    const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    console.log(`Raw Redis data for ${sessionId}:`, typeof data, data);

    // Handle both string and object responses from Redis
    if (!data) return null;

    if (typeof data === "string") {
      return JSON.parse(data);
    } else if (typeof data === "object") {
      return data as VerificationSession;
    }

    return null;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}

export async function updateSession(
  sessionId: string,
  updates: Partial<VerificationSession>
) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const updatedSession = { ...session, ...updates };
  const ttlRemaining = Math.max(
    Math.floor((session.expiresAt - Date.now()) / 1000),
    60
  );

  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    ttlRemaining,
    JSON.stringify(updatedSession)
  );
  return updatedSession;
}

export async function deleteSession(sessionId: string) {
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}

export async function clearAllSessions() {
  const keys = await redis.keys(`${SESSION_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
