import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendVerificationEmail } from "@/lib/verification";
import { otpCooldownRemaining } from "@/lib/otp";

// Sends a new 6-digit code (the old one stops working).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = await checkRateLimit(`verify:${session.user.id}`, "email");
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, emailVerifiedAt: true } });
  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (u.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });

  const wait = await otpCooldownRemaining(u.id);
  if (wait > 0) return NextResponse.json({ error: "cooldown", retryAfter: wait }, { status: 429 });

  const sent = await sendVerificationEmail(u);
  return NextResponse.json({ ok: sent });
}
