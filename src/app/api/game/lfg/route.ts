import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { blockedUserIds } from "@/lib/blocks";

// Open parties, newest first. ?game= filters by game name.
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const game = new URL(req.url).searchParams.get("game")?.trim();
  const blocked = await blockedUserIds(me.id);
  const posts = await prisma.lfgPost.findMany({
    where: { open: true, authorId: { notIn: blocked }, ...(game ? { game: { contains: game, mode: "insensitive" } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: userSelect }, players: { include: { user: { select: userSelect } } } },
  });
  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      game: p.game,
      title: p.title,
      platform: p.platform,
      slots: p.slots,
      createdAt: p.createdAt,
      author: p.author,
      players: p.players.map((x) => x.user),
      isMine: p.authorId === me.id,
      joined: p.players.some((x) => x.userId === me.id),
    })),
  });
}

export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const game = clean(b.game, 60);
  const title = clean(b.title, 120);
  const slots = Math.min(16, Math.max(2, Math.floor(Number(b.slots) || 4)));
  if (!game || !title) return fail("missing_fields");
  const open = await prisma.lfgPost.count({ where: { authorId: me.id, open: true } });
  if (open >= 5) return fail("too_many_open_parties");
  const post = await prisma.lfgPost.create({
    data: { authorId: me.id, game, title, slots, platform: clean(b.platform, 40) || null },
  });
  return NextResponse.json({ post });
}
