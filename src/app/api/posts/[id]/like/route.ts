import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { isBlockedEitherWay } from "@/lib/blocks";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const postId = params.id;

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
  if (post && (await isBlockedEitherWay(userId, post.userId))) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }
  await prisma.like.create({ data: { userId, postId } });
  if (post) {
    await notify({ recipientId: post.userId, actorId: userId, type: "LIKE", postId });
  }
  return NextResponse.json({ liked: true });
}
