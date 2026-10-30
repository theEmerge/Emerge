import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

// Reels get their own vertical feed, separate from the chronological photo
// feed - still no ranking algorithm (createdAt desc, full stop), but it
// isn't scoped to who you follow the way the main feed is, since a reels
// feed with only a handful of people in it isn't very watchable.
const PAGE_SIZE = 10;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const cursor = new URL(req.url).searchParams.get("cursor");

  const reels = await prisma.post.findMany({
    where: { isReel: true, userId: { notIn: await blockedUserIds(userId) } },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      tags: { include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } } },
      _count: { select: { comments: true, likes: true, reshares: true } },
      likes: { where: { userId }, select: { id: true } },
      reshares: { where: { resharedById: userId }, select: { id: true } },
    },
  });

  const hasMore = reels.length > PAGE_SIZE;
  const page = hasMore ? reels.slice(0, PAGE_SIZE) : reels;

  return NextResponse.json({
    reels: page.map((r) => ({
      id: r.id,
      text: r.text,
      videoUrl: r.videoUrl,
      createdAt: r.createdAt,
      user: r.user,
      tags: r.tags.map((t) => t.user),
      commentCount: r._count.comments,
      liked: r.likes.length > 0,
      likeCount: r.user.id === userId ? r._count.likes : null,
      reshared: r.reshares.length > 0,
      reshareCount: r._count.reshares,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
