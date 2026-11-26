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

// --- Cached front page --------------------------------------------------
// "/" is the public front page for visitors without a login cookie and the
// feed for members. The layout reads the session, so Next renders it on every
// request. For logged-out visitors the result is identical every time, so we
// let Netlify's CDN keep a copy and answer from a nearby edge instead of
// running a function in another continent.
//
// Safety: the copy is keyed on the login cookie (Netlify-Vary). A request that
// carries a session cookie never matches the logged-out copy, and a response
// for a logged-in user is never marked cacheable. Both the plain and the
// chunked (.0/.1) cookie names are listed, because large tokens are split.
// To switch this off without a code change, set LANDING_CACHE=off in Netlify.
const SESSION_COOKIES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];
const VARY_COOKIES = SESSION_COOKIES.flatMap((n) => [n, `${n}.0`, `${n}.1`, `${n}.2`]).join("|");

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => SESSION_COOKIES.some((n) => c.name.startsWith(n)));
}

function frontPage(req: NextRequest): NextResponse {
  const res = NextResponse.next();
  res.headers.set("Netlify-Vary", `cookie=${VARY_COOKIES}`);
  if (req.method === "GET" && !hasSessionCookie(req) && process.env.LANDING_CACHE !== "off") {
    res.headers.set("Netlify-CDN-Cache-Control", "public, durable, s-maxage=600, stale-while-revalidate=86400");
  }
  return res;
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
  if (path === "/") return frontPage(req);
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
  matcher: ["/", "/api/:path*"],
};
