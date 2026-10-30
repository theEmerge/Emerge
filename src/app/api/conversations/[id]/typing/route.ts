import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markTyping, whoIsTyping } from "@/lib/typing";

async function requireMembership(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

// POST: "I'm typing right now" - the client pings this on keystroke
// (throttled client-side), no body needed.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const membership = await requireMembership(params.id, userId);
  if (!membership) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  await markTyping(params.id, userId);
  return NextResponse.json({ ok: true });
}

// GET: who among the other participants is currently typing. Piggybacks
// on the same participant list the thread already has, so this stays a
// single cheap Redis round-trip rather than a Prisma join every poll.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const membership = await requireMembership(params.id, userId);
  if (!membership) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: params.id },
    select: { userId: true },
  });

  const typingUserIds = await whoIsTyping(
    params.id,
    participants.map((p) => p.userId),
    userId
  );

  return NextResponse.json({ typingUserIds });
}
