import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateTodayRoll, startOfDay } from "@/lib/rolls";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const selfRoll = await getOrCreateTodayRoll(userId);
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    include: { following: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
  });

  const date = startOfDay();
  const others = await Promise.all(
    follows.map(async (f) => {
      const roll = await prisma.roll.findUnique({
        where: { userId_date: { userId: f.followingId, date } },
      });
      return {
        id: f.following.id,
        name: f.following.name,
        handle: f.following.handle,
        used: roll?.framesUsed ?? 0,
        maxFrames: roll?.maxFrames ?? 24,
      };
    })
  );

  return NextResponse.json({
    self: { used: selfRoll.framesUsed, maxFrames: selfRoll.maxFrames },
    others,
  });
}
