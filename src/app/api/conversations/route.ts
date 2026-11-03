import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireVerifiedEmail } from "@/lib/verified";
import { blockedUserIds, isBlockedEitherWay } from "@/lib/blocks";
import { parseHub } from "@/lib/hubs";

// Lists the current user's conversations, newest-activity-first, each with
// a display title/avatar-name (the other person's, for a 1:1; the group's,
// for a group) and a preview of the last message. Polled by the client
// (see Messages.tsx) rather than pushed - no persistent-socket infra on
// serverless/Netlify, same tradeoff as the rest of the app.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const hub = parseHub(new URL(req.url).searchParams.get("hub"));

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId, conversation: { hub } },
    include: {
      conversation: {
        include: {
          participants: { include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { name: true } } },
          },
        },
      },
    },
  });

  const blocked = new Set(await blockedUserIds(userId));
  const shaped = participations
    // A 1:1 thread with someone blocked (either way) disappears from the list.
    .filter((p) => p.conversation.isGroup || !p.conversation.participants.some((x) => x.userId !== userId && blocked.has(x.userId)))
    .map((p) => {
      const conv = p.conversation;
      const others = conv.participants.filter((x) => x.userId !== userId).map((x) => x.user);
      const last = conv.messages[0] ?? null;
      const title = conv.isGroup ? conv.name || others.map((o) => o.name).join(", ") : others[0]?.name ?? "Unknown";
      return {
        id: conv.id,
        isGroup: conv.isGroup,
        title,
        with: conv.isGroup ? null : others[0] ?? null,
        memberCount: conv.isGroup ? conv.participants.length : undefined,
        lastMessage: last
          ? {
              text: last.gifUrl ? "GIF" : last.text,
              gifUrl: last.gifUrl,
              createdAt: last.createdAt,
              mine: last.senderId === userId,
              senderName: last.sender.name,
            }
          : null,
        unread: !!last && last.senderId !== userId && last.createdAt > p.lastReadAt,
        updatedAt: last ? last.createdAt : conv.createdAt,
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({ conversations: shaped });
}

// Two modes: {userId} finds-or-creates a 1:1 (what a profile's "Message"
// button hits), {userIds, name} always creates a new group with those
// members plus the current user. The 1:1 lookup is scoped to isGroup:
// false so being in a group with someone never gets mistaken for an
// existing DM thread with them.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  {
    const unverified = await requireVerifiedEmail(session.user.id);
    if (unverified) return unverified;
  }
  const meId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const hub = parseHub(body?.hub);

  if (Array.isArray(body?.userIds)) {
    const userIds: string[] = Array.from(new Set(body.userIds.filter((id: unknown) => typeof id === "string" && id !== meId)));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    if (userIds.length > 50) {
      return NextResponse.json({ error: "group_too_large" }, { status: 400 });
    }
    if (userIds.length < 2) {
      return NextResponse.json({ error: "need_at_least_two_members" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    const blockedSet = new Set(await blockedUserIds(meId));
    if (userIds.some((id) => blockedSet.has(id))) {
      return NextResponse.json({ error: "blocked" }, { status: 403 });
    }
    const found = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
    if (found.length !== userIds.length) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: true,
        name,
        hub,
        participants: { create: [{ userId: meId }, ...userIds.map((userId) => ({ userId }))] },
      },
    });
    return NextResponse.json({ id: conversation.id });
  }

  const { userId } = body;
  if (!userId || typeof userId !== "string" || userId === meId) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  if (await isBlockedEitherWay(meId, userId)) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }
  const otherExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!otherExists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.conversationParticipant.findFirst({
    where: { userId: meId, conversation: { isGroup: false, hub, participants: { some: { userId } } } },
    select: { conversationId: true },
  });
  if (existing) return NextResponse.json({ id: existing.conversationId });

  const conversation = await prisma.conversation.create({
    data: {
      hub,
      participants: { create: [{ userId: meId }, { userId }] },
    },
  });

  return NextResponse.json({ id: conversation.id });
}
