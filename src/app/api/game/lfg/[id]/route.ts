import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";
import { isBlockedEitherWay } from "@/lib/blocks";

type Ctx = { params: { id: string } };

// POST { action: "join" | "leave" | "close" }
export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const post = await prisma.lfgPost.findUnique({ where: { id: params.id }, include: { _count: { select: { players: true } } } });
  if (!post) return fail("not_found", 404);

  switch (b.action) {
    case "join": {
      if (!post.open) return fail("closed");
      if (post.authorId === me.id) return fail("own_party");
      if (await isBlockedEitherWay(me.id, post.authorId)) return fail("blocked", 403);
      // The host holds one slot.
      if (post._count.players + 1 >= post.slots) return fail("party_full", 409);
      await prisma.lfgPlayer.upsert({
        where: { lfgId_userId: { lfgId: post.id, userId: me.id } },
        create: { lfgId: post.id, userId: me.id },
        update: {},
      });
      return NextResponse.json({ joined: true });
    }
    case "leave": {
      await prisma.lfgPlayer.deleteMany({ where: { lfgId: post.id, userId: me.id } });
      return NextResponse.json({ joined: false });
    }
    case "close": {
      if (post.authorId !== me.id) return fail("forbidden", 403);
      await prisma.lfgPost.update({ where: { id: post.id }, data: { open: false } });
      return NextResponse.json({ ok: true });
    }
    default:
      return fail("bad_action");
  }
}
