import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Saved posts are private - nobody but the saver ever sees who saved
// what, or even that a post has been saved (no public count, unlike
// likes). POST saves, DELETE unsaves; both are idempotent.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const post = await prisma.post.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.saved.upsert({
    where: { userId_postId: { userId, postId: params.id } },
    update: {},
    create: { userId, postId: params.id },
  });

  return NextResponse.json({ saved: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await prisma.saved.deleteMany({ where: { userId, postId: params.id } });
  return NextResponse.json({ saved: false });
}
