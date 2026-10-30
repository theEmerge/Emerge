import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";

// Your servers, plus public servers you haven't joined (alphabetical, unranked).
export async function GET() {
  const me = await sessionUser();
  if (!me) return unauthorized();

  const [mine, discover] = await Promise.all([
    prisma.gameServer.findMany({
      where: { members: { some: { userId: me.id } } },
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true } }, members: { where: { userId: me.id }, select: { role: true } } },
    }),
    prisma.gameServer.findMany({
      where: { isPublic: true, members: { none: { userId: me.id } } },
      orderBy: { name: "asc" },
      take: 30,
      include: { _count: { select: { members: true } } },
    }),
  ]);

  return NextResponse.json({
    mine: mine.map((s) => ({ id: s.id, name: s.name, description: s.description, isPublic: s.isPublic, memberCount: s._count.members, role: s.members[0]?.role })),
    discover: discover.map((s) => ({ id: s.id, name: s.name, description: s.description, memberCount: s._count.members })),
  });
}

export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const name = clean(b.name, 50);
  if (!name) return fail("missing_fields");

  const owned = await prisma.gameServer.count({ where: { ownerId: me.id } });
  if (owned >= 10) return fail("too_many_servers");

  const server = await prisma.gameServer.create({
    data: {
      name,
      description: clean(b.description, 300) || null,
      isPublic: b.isPublic !== false,
      ownerId: me.id,
      inviteCode: randomBytes(5).toString("hex"),
      members: { create: { userId: me.id, role: "owner" } },
      channels: { create: [{ name: "general", topic: "Say hi" }] },
    },
  });
  return NextResponse.json({ server });
}
