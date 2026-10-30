import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyEmailOtp } from "@/lib/otp";
import { sendConfirmationEmail } from "@/lib/verification";

// Checks the 6-digit code the user typed. On success the email is marked
// verified and a confirmation email is sent.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Outer limit on top of the 5-tries-per-code cap.
  const limited = await checkRateLimit(`otp:${session.user.id}`, "login");
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { code } = await req.json().catch(() => ({}));
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });

  const result = await verifyEmailOtp(user.id, String(code ?? "").trim());
  if (result.status === "ok") {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    await sendConfirmationEmail(user).catch(() => {}); // a mail hiccup must not undo verification
    return NextResponse.json({ ok: true });
  }
  if (result.status === "invalid") return NextResponse.json({ error: "invalid", attemptsLeft: result.attemptsLeft }, { status: 400 });
  if (result.status === "locked") return NextResponse.json({ error: "locked" }, { status: 429 });
  return NextResponse.json({ error: "expired" }, { status: 400 });
}
