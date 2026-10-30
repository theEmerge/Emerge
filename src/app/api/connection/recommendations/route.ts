import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";
import { connectionBetween } from "@/lib/connections";

// Write (or rewrite) your recommendation of a connection.
export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const userId = typeof b.userId === "string" ? b.userId : "";
  const body = clean(b.body, 1500);
  if (!userId || !body || userId === me.id) return fail("invalid");
  const conn = await connectionBetween(me.id, userId);
  if (conn?.status !== "ACCEPTED") return fail("not_connected", 403);

  const recommendation = await prisma.proRecommendation.upsert({
    where: { targetId_authorId: { targetId: userId, authorId: me.id } },
    create: { targetId: userId, authorId: me.id, body },
    update: { body },
  });
  return NextResponse.json({ recommendation });
}

// The author can withdraw it; the person it is about can hide it.
export async function DELETE(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("missing_id");
  await prisma.proRecommendation.deleteMany({ where: { id, OR: [{ authorId: me.id }, { targetId: me.id }] } });
  return NextResponse.json({ ok: true });
}
