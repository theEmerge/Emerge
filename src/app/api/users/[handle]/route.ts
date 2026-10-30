import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "@/lib/rolls";
import { isBlockedEitherWay } from "@/lib/blocks";

// A user's public profile: stats, today's roll count (no cap anymore), and
// their posts (both roll frames and community posts), merged
// chronologically - same "no ranking" rule as everywhere else in the app.
const PAGE_SIZE = 20;

export async function GET(req: Request, { params }: { params: { handle: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const viewerId = session.user.id;
  const cursor = new URL(req.url).searchParams.get("cursor");

  const user = await prisma.user.findUnique({ where: { handle: params.handle } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Blocked either way: the profile simply doesn't exist for them.
  if (await isBlockedEitherWay(viewerId, user.id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [followerCount, followingCount, recognizedCount, isFollowingRow, todayRoll, posts] =
    await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.helpfulMark.count({ where: { post: { userId: user.id } } }),
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
      }),
      prisma.roll.findUnique({ where: { userId_date: { userId: user.id, date: startOfDay() } } }),
      prisma.post.findMany({
        where: { userId: user.id, isReel: false },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
          community: { select: { id: true, name: true, slug: true } },
          tags: { include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } } },
          images: { orderBy: { position: "asc" } },
          _count: { select: { comments: true, helpfulMarks: true, likes: true, reshares: true } },
          likes: { where: { userId: viewerId }, select: { id: true } },
          reshares: { where: { resharedById: viewerId }, select: { id: true } },
          savedBy: { where: { userId: viewerId }, select: { id: true } },
        },
      }),
    ]);

  const hasMore = posts.length > PAGE_SIZE;
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return NextResponse.json({
    user: { id: user.id, name: user.name, handle: user.handle, avatarUrl: user.avatarUrl, bannerUrl: user.bannerUrl, bio: user.bio },
    isSelf: user.id === viewerId,
    followerCount,
    followingCount,
    recognizedCount,
    isFollowing: !!isFollowingRow,
    roll: { used: todayRoll?.framesUsed ?? 0 },
    posts: page.map((p) => ({
      id: p.id,
      text: p.text,
      imageUrl: p.imageUrl,
      images: p.images.length > 0 ? p.images.map((img) => img.url) : p.imageUrl ? [p.imageUrl] : [],
      frameNumber: p.frameNumber,
      createdAt: p.createdAt,
      user: p.user,
      community: p.community,
      tags: p.tags.map((t) => ({ ...t.user, x: t.x, y: t.y, imageIndex: t.imageIndex })),
      commentCount: p._count.comments,
      helpfulCount: p.community ? p._count.helpfulMarks : null,
      liked: p.likes.length > 0,
      likeCount: p.user.id === viewerId ? p._count.likes : null,
      reshared: p.reshares.length > 0,
      reshareCount: p._count.reshares,
      saved: p.savedBy.length > 0,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
