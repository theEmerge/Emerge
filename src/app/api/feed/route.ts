import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

// Feed is still one merged, purely time-ordered timeline across yourself,
// people you follow, and your joined communities - but it now has two
// kinds of events instead of one:
//   - "post": an original post, sorted by its own createdAt
//   - "reshare": someone you follow (or you) resharing a post - sorted by
//     the RESHARE's createdAt, not the original post's. This is what makes
//     a reshare show up "now" in your feed even if the underlying post is
//     old, same as Instagram/Twitter-style reshares.
// There is still no engagement-based ranking: within this merged set,
// ordering is purely by timestamp.
const PAGE_SIZE = 20;

type Cursor = { ts: string };

function encodeCursor(ts: Date): string {
  return Buffer.from(JSON.stringify({ ts: ts.toISOString() } satisfies Cursor)).toString(
    "base64url"
  );
}
function decodeCursor(raw: string | null): Date | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    return new Date(parsed.ts);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const cursorTs = decodeCursor(new URL(req.url).searchParams.get("cursor"));

  const blocked = await blockedUserIds(userId);
  const [follows, memberships] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    prisma.communityMembership.findMany({ where: { userId }, select: { communityId: true } }),
  ]);
  const authorIds = [userId, ...follows.map((f) => f.followingId)].filter((id) => !blocked.includes(id));
  const communityIds = memberships.map((m) => m.communityId);

  const postInclude = {
    user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
    community: { select: { id: true, name: true, slug: true } },
    tags: { include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } } },
    images: { orderBy: { position: "asc" as const } },
    _count: { select: { comments: true, helpfulMarks: true, likes: true, reshares: true } },
    likes: { where: { userId }, select: { id: true } },
    reshares: { where: { resharedById: userId }, select: { id: true } },
    savedBy: { where: { userId }, select: { id: true } },
  } as const;

  // Fan-out of two sources, each windowed by the same cursor, then merged
  // and re-sorted - this is what lets a reshare "jump the queue" to its
  // own timestamp while original posts keep theirs.
  const [posts, reshares] = await Promise.all([
    prisma.post.findMany({
      where: {
        isReel: false,
        userId: { notIn: blocked },
        OR: [
          { userId: { in: authorIds }, communityId: null },
          { communityId: { in: communityIds } },
        ],
        ...(cursorTs ? { createdAt: { lt: cursorTs } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      include: postInclude,
    }),
    prisma.reshare.findMany({
      where: {
        resharedById: { in: authorIds },
        post: { isReel: false, userId: { notIn: blocked } },
        ...(cursorTs ? { createdAt: { lt: cursorTs } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      include: {
        resharedBy: { select: { id: true, name: true, handle: true, avatarUrl: true } },
        post: { include: postInclude },
      },
    }),
  ]);

  function shapePost(p: (typeof posts)[number]) {
    return {
      id: p.id,
      text: p.text,
      imageUrl: p.imageUrl,
      images: p.images.length > 0 ? p.images.map((img) => img.url) : p.imageUrl ? [p.imageUrl] : [],
      frameNumber: p.frameNumber,
      location: p.location,
      createdAt: p.createdAt,
      user: p.user,
      community: p.community,
      tags: p.tags.map((t) => ({ ...t.user, x: t.x, y: t.y, imageIndex: t.imageIndex })),
      commentCount: p._count.comments,
      helpfulCount: p.community ? p._count.helpfulMarks : null,
      liked: p.likes.length > 0,
      likeCount: p.user.id === userId ? p._count.likes : null,
      reshared: p.reshares.length > 0,
      reshareCount: p._count.reshares,
      saved: p.savedBy.length > 0,
    };
  }

  type FeedItem =
    | { kind: "post"; sortTs: Date; post: ReturnType<typeof shapePost> }
    | {
        kind: "reshare";
        sortTs: Date;
        reshareId: string;
        resharedBy: { id: string; name: string; handle: string };
        comment: string | null;
        post: ReturnType<typeof shapePost>;
      };

  const items: FeedItem[] = [
    ...posts.map((p) => ({ kind: "post" as const, sortTs: p.createdAt, post: shapePost(p) })),
    ...reshares.map((r) => ({
      kind: "reshare" as const,
      sortTs: r.createdAt,
      reshareId: r.id,
      resharedBy: r.resharedBy,
      comment: r.comment,
      post: shapePost(r.post),
    })),
  ];

  items.sort((a, b) => b.sortTs.getTime() - a.sortTs.getTime());

  const hasMore = items.length > PAGE_SIZE;
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items;

  // NOTE: for reshare items, ...item.post is spread FIRST and the reshare
  // fields (especially createdAt) are applied AFTER, so the reshare's own
  // timestamp wins over the original post's createdAt - that's what makes
  // the merged sort above actually correspond to what the client renders.
  const shaped = page.map((item) =>
    item.kind === "post"
      ? { type: "post" as const, ...item.post }
      : {
          ...item.post,
          type: "reshare" as const,
          reshareId: item.reshareId,
          resharedBy: item.resharedBy,
          comment: item.comment,
          createdAt: item.sortTs,
        }
  );

  return NextResponse.json({
    posts: shaped,
    nextCursor: hasMore ? encodeCursor(page[page.length - 1].sortTs) : null,
  });
}
