import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { notify } from "@/lib/notifications";
import { isBlockedEitherWay } from "@/lib/blocks";

// Toggles a reshare of a post. Resharing is its own timeline event (see
// the Reshare model + GET /api/feed), never a copy of the original post -
// deleting a reshare here just removes that event, the original post is
// untouched. Resharing your own post is blocked; there's nothing to add
// by resharing something that's already yours.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = await checkRateLimit(`reshare:${session.user.id}`, "api");
  if (!limited.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const userId = session.user.id;
  const postId = params.id;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (post.userId === userId) {
    return NextResponse.json({ error: "cannot_reshare_own_post" }, { status: 400 });
  }

  if (await isBlockedEitherWay(userId, post.userId)) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  const existing = await prisma.reshare.findUnique({
    where: { postId_resharedById: { postId, resharedById: userId } },
  });

  if (existing) {
    await prisma.reshare.delete({ where: { id: existing.id } });
    const count = await prisma.reshare.count({ where: { postId } });
    return NextResponse.json({ reshared: false, reshareCount: count });
  }

  let comment: string | undefined;
  try {
    const body = await req.json();
    comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 280) || undefined : undefined;
  } catch {
    // no body sent - a plain reshare with no added comment, that's fine
  }

  await prisma.reshare.create({ data: { postId, resharedById: userId, comment } });
  const count = await prisma.reshare.count({ where: { postId } });
  await notify({ recipientId: post.userId, actorId: userId, type: "RESHARE", postId });
  return NextResponse.json({ reshared: true, reshareCount: count });
}
