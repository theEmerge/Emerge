import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A private, one-directional list - only ownerId can ever read or edit
// their own list, and being on someone else's list grants no visibility
// into it. Used to gate Story.audience === CLOSE_FRIENDS.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const list = await prisma.closeFriend.findMany({
    where: { ownerId: session.user.id },
    include: { friend: { select: { id: true, name: true, handle: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ friends: list.map((f) => f.friend) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { userId: friendId } = await req.json().catch(() => ({}));
  if (typeof friendId !== "string" || friendId === userId) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }

  await prisma.closeFriend.upsert({
    where: { ownerId_friendId: { ownerId: userId, friendId } },
    update: {},
    create: { ownerId: userId, friendId },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { userId: friendId } = await req.json().catch(() => ({}));
  if (typeof friendId !== "string") {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }

  await prisma.closeFriend.deleteMany({ where: { ownerId: userId, friendId } });
  return NextResponse.json({ ok: true });
}
