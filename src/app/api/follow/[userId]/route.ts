import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { isBlockedEitherWay } from "@/lib/blocks";

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const followerId = session.user.id;
  const followingId = params.userId;

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return NextResponse.json({ following: false });
  }

  if (await isBlockedEitherWay(followerId, followingId)) {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }
  await prisma.follow.create({ data: { followerId, followingId } });
  await notify({ recipientId: followingId, actorId: followerId, type: "FOLLOW" });
  return NextResponse.json({ following: true });
}
