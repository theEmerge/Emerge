import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

export async function GET(req: Request, { params }: { params: { handle: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { handle: params.handle }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const blocked = await blockedUserIds(session.user.id);
  const follows = await prisma.follow.findMany({
    where: { followingId: user.id, followerId: { notIn: blocked } },
    orderBy: { createdAt: "desc" },
    include: { follower: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
  });

  return NextResponse.json({ users: follows.map((f) => f.follower) });
}
