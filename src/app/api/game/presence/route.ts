import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { blockedUserIds } from "@/lib/blocks";

// What you and the people you follow are playing right now.
export async function GET() {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const blocked = await blockedUserIds(me.id);
  const following = await prisma.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } });
  const ids = following.map((f) => f.followingId).filter((id) => !blocked.includes(id));

  const [mine, friends] = await Promise.all([
    prisma.gamePresence.findUnique({ where: { userId: me.id } }),
    prisma.gamePresence.findMany({
      where: { userId: { in: ids } },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: userSelect } },
      take: 30,
    }),
  ]);
  return NextResponse.json({
    mine: mine?.game ?? null,
    friends: friends.map((p) => ({ user: p.user, game: p.game, since: p.updatedAt })),
  });
}

// PUT { game } sets your rich status; an empty game clears it.
export async function PUT(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const game = clean(b.game, 60);
  if (!game) {
    await prisma.gamePresence.deleteMany({ where: { userId: me.id } });
    return NextResponse.json({ game: null });
  }
  await prisma.gamePresence.upsert({
    where: { userId: me.id },
    create: { userId: me.id, game },
    update: { game },
  });
  return NextResponse.json({ game });
}
