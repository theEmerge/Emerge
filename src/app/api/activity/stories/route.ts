import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Your story archive: every story you've posted, including ones that have
// expired from the tray. Private.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stories = await prisma.story.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { views: true } } },
  });
  const now = Date.now();
  return NextResponse.json({
    stories: stories.map((s) => ({
      id: s.id,
      imageUrl: s.imageUrl,
      videoUrl: s.videoUrl,
      createdAt: s.createdAt,
      closeFriendsOnly: s.audience === "CLOSE_FRIENDS",
      viewCount: s._count.views,
      active: s.expiresAt.getTime() > now,
    })),
  });
}
