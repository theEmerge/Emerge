import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One reaction per user per message, same as Instagram DMs - POSTing a
// new emoji replaces whatever this user had reacted with before.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { emoji } = await req.json();
  if (typeof emoji !== "string" || !emoji.trim()) {
    return NextResponse.json({ error: "invalid_emoji" }, { status: 400 });
  }

  const message = await prisma.message.findUnique({
    where: { id: params.id },
    select: { conversationId: true },
  });
  if (!message) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId } },
  });
  if (!membership) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  await prisma.messageReaction.upsert({
    where: { messageId_userId: { messageId: params.id, userId } },
    update: { emoji: emoji.trim() },
    create: { messageId: params.id, userId, emoji: emoji.trim() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await prisma.messageReaction.deleteMany({
    where: { messageId: params.id, userId },
  });

  return NextResponse.json({ ok: true });
}
