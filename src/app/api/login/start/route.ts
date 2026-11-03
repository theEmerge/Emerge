import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { otpCooldownRemaining } from "@/lib/otp";
import { sendLoginCodeEmail } from "@/lib/verification";
import { DUMMY_HASH } from "@/lib/password";

// Login step 1: check email + password, then email a 6-digit code.
// No session is created here - that only happens in step 2 (NextAuth
// authorize) once the code is also right. Wrong email and wrong password
// return the same response so this can't be used to find out who has an account.
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  }
  if (email.length > 254 || password.length > 1000) return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  const key = email.trim().toLowerCase();

  const limited = await checkRateLimit(`login:${key}`, "login");
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
  // Constant-time-ish: always one bcrypt compare, even if the account doesn't exist.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  const wait = await otpCooldownRemaining(user.id);
  if (wait > 0) return NextResponse.json({ ok: true, cooldown: wait });

  const mailLimited = await checkRateLimit(`logincode:${user.id}`, "email");
  if (!mailLimited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const sent = await sendLoginCodeEmail(user);
  if (!sent) return NextResponse.json({ error: "send_failed" }, { status: 502 });
  return NextResponse.json({ ok: true, cooldown: 30 });
}
