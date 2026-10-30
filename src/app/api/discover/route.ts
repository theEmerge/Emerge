import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

const PAGE = 30;

// Recent photo posts from everyone else on Emerge (newest first, no
// algorithm). People you follow are included on purpose: with a small
// community, hiding them left this page empty. Profiles
// are public by design, so no extra privacy filtering is needed here.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = session.user.id;

  const raw = new URL(req.url).searchParams.get("cursor");
  const cursor = raw && !isNaN(Date.parse(raw)) ? new Date(raw) : null;

  const rows = await prisma.post.findMany({
    where: {
      isReel: false,
      communityId: null,
      imageUrl: { not: null },
      userId: { notIn: [me, ...(await blockedUserIds(me))] },
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    include: {
      user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      images: { orderBy: { position: "asc" } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: me }, select: { id: true } },
      savedBy: { where: { userId: me }, select: { id: true } },
    },
  });

  const page = rows.slice(0, PAGE);
  return NextResponse.json({
    posts: page.map((p) => ({
      id: p.id,
      text: p.text,
      imageUrl: p.imageUrl,
      images: p.images.length > 0 ? p.images.map((i) => i.url) : p.imageUrl ? [p.imageUrl] : [],
      videoUrl: null,
      isReel: false,
      createdAt: p.createdAt,
      location: p.location,
      user: p.user,
      likeCount: p.user.id === me ? p._count.likes : null,
      commentCount: p._count.comments,
      liked: p.likes.length > 0,
      saved: p.savedBy.length > 0,
    })),
    nextCursor: rows.length > PAGE ? page[page.length - 1].createdAt.toISOString() : null,
  });
}
