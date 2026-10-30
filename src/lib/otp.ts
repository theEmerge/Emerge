import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

// Email verification codes (6 digits). A 6-digit code has only a million
// possibilities, so a plain hash would be reversible from a database leak.
// We store an HMAC keyed with the server secret, and cap guesses per code.

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

const mac = (userId: string, code: string) =>
  createHmac("sha256", process.env.NEXTAUTH_SECRET || "dev-only-secret")
    .update(`email-verify:${userId}:${code}`)
    .digest("hex");

// Creates a fresh code and invalidates any older unused one.
export async function createEmailOtp(userId: string): Promise<string> {
  await prisma.emailOtp.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.emailOtp.create({
    data: { userId, codeHash: mac(userId, code), expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000) },
  });
  return code;
}

// Seconds until another code may be requested (0 = allowed now).
export async function otpCooldownRemaining(userId: string): Promise<number> {
  const last = await prisma.emailOtp.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!last) return 0;
  const left = OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - last.createdAt.getTime()) / 1000);
  return left > 0 ? left : 0;
}

export type OtpResult =
  | { status: "ok" }
  | { status: "invalid"; attemptsLeft: number }
  | { status: "expired" }
  | { status: "locked" };

export async function verifyEmailOtp(userId: string, code: string): Promise<OtpResult> {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return { status: "invalid", attemptsLeft: OTP_MAX_ATTEMPTS };

  const row = await prisma.emailOtp.findFirst({ where: { userId, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt.getTime() < Date.now()) return { status: "expired" };

  // Spend an attempt atomically before comparing, so parallel guesses can't
  // sneak past the limit.
  const spent = await prisma.emailOtp.updateMany({
    where: { id: row.id, usedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (spent.count !== 1) return { status: "locked" };

  const a = Buffer.from(mac(userId, code));
  const b = Buffer.from(row.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const attemptsLeft = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    return attemptsLeft <= 0 ? { status: "locked" } : { status: "invalid", attemptsLeft };
  }

  // Claim it so the same code can't be used twice.
  const claimed = await prisma.emailOtp.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? { status: "ok" } : { status: "expired" };
}
