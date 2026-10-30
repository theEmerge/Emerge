import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";
import { connectionBetween } from "@/lib/connections";

// Toggle your endorsement of one of someone's listed skills. Only
// connections can endorse, and only for skills the person lists.
export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const userId = typeof b.userId === "string" ? b.userId : "";
  const skill = clean(b.skill, 40);
  if (!userId || !skill || userId === me.id) return fail("invalid");

  const conn = await connectionBetween(me.id, userId);
  if (conn?.status !== "ACCEPTED") return fail("not_connected", 403);
  const profile = await prisma.proProfile.findUnique({ where: { userId }, select: { skills: true } });
  if (!profile?.skills.includes(skill)) return fail("unknown_skill", 404);

  const where = { targetId_endorserId_skill: { targetId: userId, endorserId: me.id, skill } };
  const existing = await prisma.proEndorsement.findUnique({ where });
  if (existing) {
    await prisma.proEndorsement.delete({ where });
    return NextResponse.json({ endorsed: false });
  }
  await prisma.proEndorsement.create({ data: { targetId: userId, endorserId: me.id, skill } });
  return NextResponse.json({ endorsed: true });
}
