import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { otpCooldownRemaining } from "@/lib/otp";

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "";
  return `${name.slice(0, 1)}***@${domain}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, emailVerifiedAt: true } });
  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const verified = !!u.emailVerifiedAt;
  return NextResponse.json({
    verified,
    email: verified ? null : maskEmail(u.email),
    cooldown: verified ? 0 : await otpCooldownRemaining(session.user.id),
  });
}
