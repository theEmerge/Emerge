import { NextResponse } from "next/server";
import { prisma } from "./prisma";

// Unverified users can browse but not post or message. Call at the top of any
// write route; returns a 403 response to send back, or null if allowed.
export async function requireVerifiedEmail(userId: string): Promise<NextResponse | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!u?.emailVerifiedAt) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }
  return null;
}

// Reports/admin: comma-separated emails in ADMIN_EMAILS (Netlify env).
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}
