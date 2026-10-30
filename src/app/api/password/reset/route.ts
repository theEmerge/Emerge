import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/tokens";

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }
  const userId = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!userId) return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  // The link proves they own the inbox, so this also counts as verifying it.
  await prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
