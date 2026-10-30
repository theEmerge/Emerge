import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireVerifiedEmail } from "@/lib/verified";
import { blockedUserIds } from "@/lib/blocks";

async function requireMembership(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

// GET also marks the thread read for the requesting participant - simplest
// place to do it, since opening/polling a thread IS reading it.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const membership = await requireMembership(params.id, userId);
  if (!membership) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  const blockedIds = await blockedUserIds(userId);
  // A 1:1 thread with a blocked person is closed (no reading, no sending).
  const convMeta = await prisma.conversation.findUnique({
    where: { id: params.id },
    select: { isGroup: true, participants: { select: { userId: true } } },
  });
  if (convMeta && !convMeta.isGroup && convMeta.participants.some((p) => p.userId !== userId && blockedIds.includes(p.userId))) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  const [messages, conversation] = await Promise.all([
    prisma.message.findMany({
      // In groups, messages from people you blocked (or who blocked you) are hidden.
      where: { conversationId: params.id, senderId: { notIn: blockedIds } },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, handle: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            text: true,
            gifUrl: true,
            sender: { select: { name: true } },
          },
        },
      },
    }),
    prisma.conversation.findUnique({
      where: { id: params.id },
      include: { participants: { include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } } } },
    }),
  ]);

  await prisma.conversationParticipant.update({
    where: { id: membership.id },
    data: { lastReadAt: new Date() },
  });

  const others = conversation?.participants.filter((p) => p.userId !== userId) ?? [];
  const otherUsers = others.map((p) => p.user);
  const isGroup = conversation?.isGroup ?? false;
  const title = isGroup ? conversation?.name || otherUsers.map((o) => o.name).join(", ") : otherUsers[0]?.name ?? "Unknown";

  // "Seen" = every other participant's lastReadAt is at or after the
  // message's createdAt. For a 1:1 that's just the one other person; for
  // a group it means everyone has read that far (Instagram-group-style,
  // not a per-person breakdown - keeps this simple).
  const othersLastRead = others.length > 0 ? others.reduce((min, p) => (p.lastReadAt < min ? p.lastReadAt : min), others[0].lastReadAt) : null;

  return NextResponse.json({
    isGroup,
    title,
    with: isGroup ? null : otherUsers[0] ?? null,
    members: isGroup ? otherUsers : undefined,
    messages: messages.map((m) => ({
      id: m.id,
      text: m.text,
      gifUrl: m.gifUrl,
      createdAt: m.createdAt,
      mine: m.senderId === userId,
      sender: m.sender,
      seenAt: m.senderId === userId && othersLastRead && othersLastRead >= m.createdAt ? othersLastRead : null,
      replyTo: m.replyTo
        ? { id: m.replyTo.id, text: m.replyTo.text, gifUrl: m.replyTo.gifUrl, senderName: m.replyTo.sender.name }
        : null,
      // Grouped by emoji so the bubble can render "❤️ 2, 😂 1" instead of
      // one badge per reactor - mine flags whether the requester is
      // among them, for the "tap again to remove" toggle.
      reactions: Object.values(
        m.reactions.reduce<Record<string, { emoji: string; count: number; mine: boolean }>>((acc, r) => {
          if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, mine: false };
          acc[r.emoji].count += 1;
          if (r.userId === userId) acc[r.emoji].mine = true;
          return acc;
        }, {})
      ),
    })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  {
    const unverified = await requireVerifiedEmail(session.user.id);
    if (unverified) return unverified;
  }
  const userId = session.user.id;

  const limited = await checkRateLimit(`message:${userId}`, "post");
  if (!limited.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const membership = await requireMembership(params.id, userId);
  if (!membership) return NextResponse.json({ error: "not_a_participant" }, { status: 403 });

  {
    const blockedIds = await blockedUserIds(userId);
    const convMeta = await prisma.conversation.findUnique({
      where: { id: params.id },
      select: { isGroup: true, participants: { select: { userId: true } } },
    });
    if (convMeta && !convMeta.isGroup && convMeta.participants.some((p) => p.userId !== userId && blockedIds.includes(p.userId))) {
      return NextResponse.json({ error: "blocked" }, { status: 403 });
    }
  }

  const { text, gifUrl, replyToId } = await req.json();
  const trimmed = typeof text === "string" ? text.trim().slice(0, 2000) : "";
  const gif = typeof gifUrl === "string" && gifUrl.trim() ? gifUrl.trim() : null;
  if (!trimmed && !gif) return NextResponse.json({ error: "empty_message" }, { status: 400 });

  // Only allow replying to a message that's actually in this conversation
  // - otherwise a crafted replyToId could quote a message from a thread
  // the sender isn't even part of.
  let validReplyToId: string | null = null;
  if (typeof replyToId === "string" && replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: replyToId, conversationId: params.id },
      select: { id: true },
    });
    validReplyToId = target?.id ?? null;
  }

  const message = await prisma.message.create({
    data: {
      conversationId: params.id,
      senderId: userId,
      text: trimmed || (gif ? "" : ""),
      gifUrl: gif,
      replyToId: validReplyToId,
    },
    include: {
      sender: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      replyTo: { select: { id: true, text: true, gifUrl: true, sender: { select: { name: true } } } },
    },
  });

  await prisma.conversationParticipant.update({
    where: { id: membership.id },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({
    id: message.id,
    text: message.text,
    gifUrl: message.gifUrl,
    createdAt: message.createdAt,
    mine: true,
    sender: message.sender,
    seenAt: null,
    replyTo: message.replyTo
      ? { id: message.replyTo.id, text: message.replyTo.text, gifUrl: message.replyTo.gifUrl, senderName: message.replyTo.sender.name }
      : null,
    reactions: [],
  });
}
