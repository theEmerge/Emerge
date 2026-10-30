import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Your past rolls, most recent first, each with its frames in order -
// the data behind the contact-sheet archive view.
const PAGE_SIZE = 10;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cursor = new URL(req.url).searchParams.get("cursor");

  const rolls = await prisma.roll.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      posts: {
        orderBy: { frameNumber: "asc" },
        select: { id: true, imageUrl: true, frameNumber: true },
      },
    },
  });

  const hasMore = rolls.length > PAGE_SIZE;
  const page = hasMore ? rolls.slice(0, PAGE_SIZE) : rolls;

  return NextResponse.json({
    rolls: page.map((r) => ({
      id: r.id,
      date: r.date,
      used: r.framesUsed,
      maxFrames: r.maxFrames,
      frames: r.posts,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
