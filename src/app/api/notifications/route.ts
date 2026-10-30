import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";
import { parseHub } from "@/lib/hubs";

// Flat, chronological list - same "no algorithm" stance as the rest of
// the app: every like/comment/follow/reshare shows up as its own row in
// the order it happened, nothing grouped or collapsed server-side.
const PAGE_SIZE = 40;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const hub = parseHub(new URL(req.url).searchParams.get("hub"));
  const blocked = await blockedUserIds(session.user.id);
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: session.user.id, hub, actorId: { notIn: blocked } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        actor: { select: { id: true, name: true, handle: true, avatarUrl: true } },
        post: { select: { id: true, imageUrl: true, text: true, isReel: true } },
      },
    }),
    prisma.notification.count({ where: { recipientId: session.user.id, hub, read: false, actorId: { notIn: blocked } } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
