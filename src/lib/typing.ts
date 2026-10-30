import { Redis } from "@upstash/redis";

// Typing indicators are ephemeral by nature (a few seconds of state), so
// Redis keys with a short TTL are a much better fit than a DB table -
// nothing to clean up, and it naturally expires if a tab is closed
// mid-keystroke. Same "disabled when unconfigured" fallback as
// rateLimit.ts: local dev without Upstash env vars just never shows a
// typing indicator, rather than erroring.

const TTL_SECONDS = 4;

const redisConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let client: Redis | null = null;
function getRedis(): Redis | null {
  if (!redisConfigured) return null;
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return client;
}

function key(conversationId: string, userId: string) {
  return `emerge:typing:${conversationId}:${userId}`;
}

export async function markTyping(conversationId: string, userId: string) {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(key(conversationId, userId), "1", { ex: TTL_SECONDS });
}

// Returns the userIds (excluding excludeUserId) currently typing in this
// conversation. Only checked against the small list of other participants
// passed in - no SCAN needed, so this stays cheap even on a shared Redis.
export async function whoIsTyping(
  conversationId: string,
  candidateUserIds: string[],
  excludeUserId: string
): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  const others = candidateUserIds.filter((id) => id !== excludeUserId);
  if (others.length === 0) return [];
  const results = await Promise.all(others.map((id) => redis.get(key(conversationId, id))));
  return others.filter((_, i) => results[i]);
}
