import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

// A single community's page: its info plus its own chronological feed.
// Same ordering rule as the main feed - createdAt desc, nothing else.
const PAGE_SIZE = 20;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const cursor = new URL(req.url).searchParams.get("cursor");

  const community = await prisma.community.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId }, select: { id: true } },
    },
  });
  if (!community) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { communityId: params.id, userId: { notIn: await blockedUserIds(session.user.id) } },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      _count: { select: { comments: true, helpfulMarks: true } },
    },
  });

  const hasMore = posts.length > PAGE_SIZE;
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return NextResponse.json({
    community: {
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description,
      memberCount: community._count.members,
      joined: community.members.length > 0,
    },
    posts: page.map((p) => ({
      id: p.id,
      text: p.text,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      user: p.user,
      commentCount: p._count.comments,
      helpfulCount: p._count.helpfulMarks,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
