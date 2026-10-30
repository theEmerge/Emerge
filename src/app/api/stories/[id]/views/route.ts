import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Who's seen a story - only the story's own author can see this (same as
// Instagram), so this checks ownership before returning anything.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const story = await prisma.story.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (story.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const views = await prisma.storyView.findMany({
    where: { storyId: params.id, viewerId: { not: session.user.id } },
    orderBy: { viewedAt: "desc" },
    include: { viewer: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
  });

  return NextResponse.json({ users: views.map((v) => v.viewer) });
}
