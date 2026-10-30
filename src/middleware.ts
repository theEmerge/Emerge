import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

// Netlify sets x-nf-client-connection-ip itself from the real TCP connection,
// so a client cannot fake it. x-forwarded-for is client-controlled (anyone
// can send their own value and get a fresh rate-limit bucket every request),
// so it is only used as a fallback when the Netlify header is absent, i.e.
// local dev. Never reorder these.
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-nf-client-connection-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

// IP-based rate limiting, now only where it protects something:
//  - login/register (brute-force) and
//  - writes (POST/PUT/PATCH/DELETE).
// Plain GETs and the NextAuth session/csrf lookups used to each pay a
// network round-trip to Redis before the real work even started, which is
// pure latency on every feed/stories/notification read. Individual write
// routes still layer per-user limits on top.
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAuthAttempt =
    (path.startsWith("/api/auth/callback") || path.startsWith("/api/register") || path.startsWith("/api/password")) &&
    req.method !== "GET";
  const isWrite = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";

  if (!isAuthAttempt && !isWrite) return NextResponse.next();

  const ip = getClientIp(req);

  const { success } = await checkRateLimit(`ip:${ip}`, isAuthAttempt ? "auth" : "api");
  if (!success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
