import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/tokens";

// POST (not GET) so mail scanners that pre-open links can't use up the token.
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  const userId = await consumeAuthToken(token, "EMAIL_VERIFY");
  if (!userId) return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
