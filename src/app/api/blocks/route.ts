import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Accounts I have blocked (for Settings > Blocked accounts).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.block.findMany({
    where: { blockerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { blocked: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
  });
  return NextResponse.json({ users: rows.map((r) => r.blocked) });
}

// Block someone: hides both of you from each other and stops DMs, follows,
// comments and likes between you. Existing follows (both ways) are removed.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = session.user.id;

  const { userId } = await req.json().catch(() => ({}));
  if (!userId || typeof userId !== "string" || userId === me) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: me, blockedId: userId } },
      create: { blockerId: me, blockedId: userId },
      update: {},
    }),
    prisma.follow.deleteMany({
      where: { OR: [{ followerId: me, followingId: userId }, { followerId: userId, followingId: me }] },
    }),
    prisma.closeFriend.deleteMany({
      where: { OR: [{ ownerId: me, friendId: userId }, { ownerId: userId, friendId: me }] },
    }),
  ]);
  return NextResponse.json({ blocked: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  await prisma.block.deleteMany({ where: { blockerId: session.user.id, blockedId: userId } });
  return NextResponse.json({ blocked: false });
}
