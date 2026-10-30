import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gridInclude, shapeGridPost } from "@/lib/gridPost";

// Posts and reels you've liked, most recently liked first. Private.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = session.user.id;

  const rows = await prisma.like.findMany({
    where: { userId: me },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { post: { include: gridInclude(me) } },
  });
  return NextResponse.json({ posts: rows.filter((r) => r.post).map((r) => shapeGridPost(r.post, me)) });
}
