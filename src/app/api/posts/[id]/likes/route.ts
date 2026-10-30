import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Who liked a given post, newest like first. Owner-only (403 otherwise).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Likes are hidden: only the post's author may see who liked it.
  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (post.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const likes = await prisma.like.findMany({
    where: { postId: params.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
  });

  return NextResponse.json({ users: likes.map((l) => l.user) });
}
