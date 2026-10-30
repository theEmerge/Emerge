import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gridInclude, shapeGridPost } from "@/lib/gridPost";

// Comments you've written on posts and reels, newest first, each with the
// post it was left on. Private.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = session.user.id;

  const rows = await prisma.comment.findMany({
    where: { userId: me },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { post: { include: gridInclude(me) } },
  });
  return NextResponse.json({
    items: rows
      .filter((c) => c.post)
      .map((c) => ({ id: c.id, text: c.text, createdAt: c.createdAt, post: shapeGridPost(c.post, me) })),
  });
}
