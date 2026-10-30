import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

// A private collection - only ever the caller's own saves (there's no
// userId param here on purpose, unlike a public profile route). Ordered
// by when it was saved, not when the post was created, same as
// Instagram's Saved tab.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const blockedIds = await blockedUserIds(userId);
  const saves = await prisma.saved.findMany({
    where: { userId, post: { userId: { notIn: blockedIds } } },
    orderBy: { createdAt: "desc" },
    include: {
      post: {
        include: {
          user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
          images: { orderBy: { position: "asc" } },
          _count: { select: { likes: true, comments: true } },
          likes: { where: { userId }, select: { id: true } },
        },
      },
    },
  });

  return NextResponse.json({
    posts: saves
      .filter((s) => s.post)
      .map((s) => ({
        id: s.post.id,
        text: s.post.text,
        imageUrl: s.post.imageUrl,
        images: s.post.images.length > 0 ? s.post.images.map((img) => img.url) : s.post.imageUrl ? [s.post.imageUrl] : [],
        videoUrl: s.post.videoUrl,
        isReel: s.post.isReel,
        createdAt: s.post.createdAt,
        savedAt: s.createdAt,
        user: s.post.user,
        location: s.post.location,
        liked: s.post.likes.length > 0,
        saved: true,
        likeCount: s.post.user.id === userId ? s.post._count.likes : null,
        commentCount: s.post._count.comments,
      })),
  });
}
