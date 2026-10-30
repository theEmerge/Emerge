import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePostCascade } from "@/lib/moderation";

// Only the post's author can delete it. There's no cascading delete set
// up at the DB level (see schema.prisma), so everything that references
// the post - comments, likes, helpful marks, reshares - has to be cleared
// first. Doing that in one transaction means a failure partway through
// rolls back cleanly instead of leaving orphaned rows or a half-deleted
// post behind.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (post.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await deletePostCascade(params.id);

  return NextResponse.json({ deleted: true });
}
