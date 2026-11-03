import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limits are Redis-backed (Upstash) so they hold correctly across
// multiple server instances / serverless invocations - an in-memory
// counter would reset per-instance and be trivially bypassed.
//
// In local dev, if UPSTASH_REDIS_REST_URL / TOKEN aren't set, rate
// limiting is disabled (open) rather than blocking development. In
// production this should always be configured - see .env.example.

type Tier = "auth" | "login" | "email" | "post" | "upload" | "api";

const TIER_CONFIG: Record<Tier, { limit: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  // Login/register attempts, per-IP. Loosened from 10 to 40 per minute so a
  // whole school on one Wi-Fi (shared IP) isn't locked out; brute force on a
  // single account is stopped by the per-account "login" tier below.
  auth: { limit: 40, window: "1 m" },
  // Login attempts per account (email): 8 tries per 10 minutes.
  login: { limit: 8, window: "10 m" },
  // Emails we send on request (password reset, verification resend):
  // 3 per 15 minutes per account/address, so nobody can use us to spam.
  email: { limit: 3, window: "15 m" },
  // Creating posts: generous but bounded - the roll cap already limits
  // photo posts to 24/day, this mainly guards text posts + community posts.
  post: { limit: 30, window: "1 m" },
  // Image uploads: the most expensive operation (re-encoding + storage).
  upload: { limit: 20, window: "1 m" },
  // Everything else (feed reads, likes, follows, etc).
  api: { limit: 120, window: "1 m" },
};

const redisConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let warned = false;

// Fallback used when Redis isn't configured (or is unreachable). It only
// counts within one server instance, so it is weaker than Upstash, but it
// means brute-force protection never silently turns OFF in production.
const memory = new Map<string, number[]>();
function memoryLimit(key: string, tier: Tier): boolean {
  const { limit, window } = TIER_CONFIG[tier];
  const [n, unit] = window.split(" ");
  const ms = Number(n) * (unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000);
  const now = Date.now();
  const k = `${tier}:${key}`;
  const hits = (memory.get(k) || []).filter((t) => now - t < ms);
  if (hits.length >= limit) {
    memory.set(k, hits);
    return false;
  }
  hits.push(now);
  memory.set(k, hits);
  if (memory.size > 5000) {
    for (const [mk, v] of memory) if (!v.length || now - v[v.length - 1] > 3_600_000) memory.delete(mk);
  }
  return true;
}

const limiters: Partial<Record<Tier, Ratelimit>> = {};

function getLimiter(tier: Tier): Ratelimit | null {
  if (!redisConfigured) {
    if (!warned) {
      console.warn(
        process.env.NODE_ENV === "production"
          ? "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set - using a per-instance in-memory limiter. Configure Upstash for real protection."
          : "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set - rate limiting is disabled in local dev."
      );
      warned = true;
    }
    return null;
  }
  if (!limiters[tier]) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const { limit, window } = TIER_CONFIG[tier];
    limiters[tier] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `emerge:ratelimit:${tier}`,
      analytics: false,
    });
  }
  return limiters[tier]!;
}

// key should already be scoped (e.g. `post:${userId}` or `auth:${ip}`) -
// this function just applies the tier's threshold to whatever key you pass.
export async function checkRateLimit(
  key: string,
  tier: Tier
): Promise<{ success: boolean; remaining?: number }> {
  const limiter = getLimiter(tier);
  if (!limiter) {
    // Open only in local dev; production falls back to the in-memory limiter.
    if (process.env.NODE_ENV !== "production") return { success: true };
    return { success: memoryLimit(key, tier) };
  }
  try {
    const result = await limiter.limit(key);
    return { success: result.success, remaining: result.remaining };
  } catch (e) {
    // Redis hiccup: don't take the site down, and don't fail open either.
    console.error("[rateLimit] Redis error, using in-memory fallback", e);
    return { success: memoryLimit(key, tier) };
  }
}
