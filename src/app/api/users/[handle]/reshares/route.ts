import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gridInclude, shapeGridPost } from "@/lib/gridPost";

// Everything this person has reshared (posts and reels), newest reshare
// first. Reshares already show up in followers' feeds, so they're public.
export async function GET(_req: Request, { params }: { params: { handle: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { handle: params.handle }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await prisma.reshare.findMany({
    where: { resharedById: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { post: { include: gridInclude(session.user.id) } },
  });
  return NextResponse.json({ posts: rows.filter((r) => r.post).map((r) => shapeGridPost(r.post, session.user.id)) });
}
