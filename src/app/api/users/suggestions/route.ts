import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

// "Worth following" rail: people you don't follow yet, most-followed first.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = session.user.id;

  const mine = await prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } });
  const exclude = [me, ...mine.map((f) => f.followingId), ...(await blockedUserIds(me))];

  const users = await prisma.user.findMany({
    where: { id: { notIn: exclude } },
    select: { id: true, name: true, handle: true, avatarUrl: true },
    orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
    take: 4,
  });
  return NextResponse.json({ users });
}
