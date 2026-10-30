import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocks";

// Small helper endpoint for starting a new DM - "who do I want to message"
// search by name/handle. Not a general discovery/search feature.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: [session.user.id, ...(await blockedUserIds(session.user.id))] },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { handle: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, handle: true, avatarUrl: true },
    take: 8,
  });

  return NextResponse.json({ users });
}
