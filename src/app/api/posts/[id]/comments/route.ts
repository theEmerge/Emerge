import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { requireVerifiedEmail } from "@/lib/verified";
import { blockedUserIds, isBlockedEitherWay } from "@/lib/blocks";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const comments = await prisma.comment.findMany({
    where: { postId: params.id, userId: { notIn: await blockedUserIds(session.user.id) } },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, handle: true, avatarUrl: true } } },
  });

  return NextResponse.json({ comments });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  {
    const unverified = await requireVerifiedEmail(session.user.id);
    if (unverified) return unverified;
  }

  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim()) return NextResponse.json({ error: "empty_comment" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "comment_too_long" }, { status: 400 });

  const postOwner = await prisma.post.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!postOwner) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (postOwner && (await isBlockedEitherWay(session.user.id, postOwner.userId))) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: { userId: session.user.id, postId: params.id, text: text.trim() },
    include: { user: { select: { name: true, handle: true, avatarUrl: true } } },
  });

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (post) {
    await notify({ recipientId: post.userId, actorId: session.user.id, type: "COMMENT", postId: params.id });
  }

  return NextResponse.json({ comment });
}
