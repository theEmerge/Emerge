import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { checkRateLimit } from "./rateLimit";
import { requireVerifiedEmail } from "./verified";

// Shared plumbing for the Connection, Game and Developer hub APIs.
// Every hub route authenticates with the same Emerge session.

export const userSelect = { id: true, name: true, handle: true, avatarUrl: true } as const;

export type HubUser = { id: string; handle: string; name?: string | null };

export async function sessionUser(): Promise<HubUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? { id: session.user.id, handle: session.user.handle, name: session.user.name } : null;
}

export const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Writes: per-user rate limit plus the same verified-email rule the rest of
// the app uses. Returns a response to send back, or null if the write may go on.
export async function guardWrite(userId: string): Promise<NextResponse | null> {
  const { success } = await checkRateLimit(`hub:${userId}`, "post");
  if (!success) return fail("rate_limited", 429);
  return requireVerifiedEmail(userId);
}

export function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanUrl(value: unknown): string | null {
  const v = clean(value, 300);
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
