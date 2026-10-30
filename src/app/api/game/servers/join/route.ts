import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";

// Join a server with its invite code (works for private servers too).
export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const code = clean(b.code, 40);
  if (!code) return fail("missing_code");
  const server = await prisma.gameServer.findUnique({ where: { inviteCode: code } });
  if (!server) return fail("invalid_code", 404);
  await prisma.serverMember.upsert({
    where: { serverId_userId: { serverId: server.id, userId: me.id } },
    create: { serverId: server.id, userId: me.id },
    update: {},
  });
  return NextResponse.json({ id: server.id });
}
