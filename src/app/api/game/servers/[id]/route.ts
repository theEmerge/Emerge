import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";

type Ctx = { params: { id: string } };

const isStaff = (role?: string | null) => role === "owner" || role === "admin";

export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const server = await prisma.gameServer.findUnique({
    where: { id: params.id },
    include: {
      channels: { orderBy: { createdAt: "asc" } },
      members: { include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } },
      _count: { select: { members: true } },
    },
  });
  if (!server) return fail("not_found", 404);
  const mine = server.members.find((m) => m.userId === me.id);
  if (!mine && !server.isPublic) return fail("forbidden", 403);

  // Public servers can be previewed before joining; only members see the roster.
  if (!mine) {
    return NextResponse.json({
      server: { id: server.id, name: server.name, description: server.description, memberCount: server._count.members },
      isMember: false,
    });
  }

  const presence = await prisma.gamePresence.findMany({
    where: { userId: { in: server.members.map((m) => m.userId) } },
    select: { userId: true, game: true },
  });
  const playing = new Map(presence.map((p) => [p.userId, p.game]));

  return NextResponse.json({
    server: {
      id: server.id,
      name: server.name,
      description: server.description,
      isPublic: server.isPublic,
      memberCount: server._count.members,
      inviteCode: isStaff(mine.role) ? server.inviteCode : null,
    },
    isMember: true,
    role: mine.role,
    channels: server.channels.map((c) => ({ id: c.id, name: c.name, topic: c.topic })),
    members: server.members.map((m) => ({ role: m.role, user: m.user, playing: playing.get(m.userId) ?? null })),
  });
}

// POST { action: "join" | "leave" | "channel" | "deleteChannel" | "role" | "kick" | "delete", ... }
export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);

  const server = await prisma.gameServer.findUnique({ where: { id: params.id } });
  if (!server) return fail("not_found", 404);
  const membership = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId: server.id, userId: me.id } } });

  if (b.action === "join") {
    if (!server.isPublic && !membership) return fail("invite_required", 403);
    if (!membership) await prisma.serverMember.create({ data: { serverId: server.id, userId: me.id } });
    return NextResponse.json({ ok: true });
  }
  if (!membership) return fail("not_a_member", 403);

  switch (b.action) {
    case "leave": {
      if (membership.role === "owner") return fail("owner_cannot_leave");
      await prisma.serverMember.delete({ where: { id: membership.id } });
      return NextResponse.json({ ok: true });
    }
    case "channel": {
      if (!isStaff(membership.role)) return fail("forbidden", 403);
      const name = clean(b.name, 30).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      if (!name) return fail("bad_name");
      if ((await prisma.channel.count({ where: { serverId: server.id } })) >= 20) return fail("too_many_channels");
      try {
        const channel = await prisma.channel.create({ data: { serverId: server.id, name, topic: clean(b.topic, 100) || null } });
        return NextResponse.json({ channel });
      } catch {
        return fail("name_taken", 409);
      }
    }
    case "deleteChannel": {
      if (!isStaff(membership.role)) return fail("forbidden", 403);
      const count = await prisma.channel.count({ where: { serverId: server.id } });
      if (count <= 1) return fail("last_channel");
      await prisma.channel.deleteMany({ where: { id: String(b.channelId || ""), serverId: server.id } });
      return NextResponse.json({ ok: true });
    }
    case "role": {
      if (membership.role !== "owner") return fail("forbidden", 403);
      const role = b.role === "admin" ? "admin" : "member";
      await prisma.serverMember.updateMany({ where: { serverId: server.id, userId: String(b.userId || ""), role: { not: "owner" } }, data: { role } });
      return NextResponse.json({ ok: true });
    }
    case "kick": {
      if (!isStaff(membership.role)) return fail("forbidden", 403);
      const target = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId: server.id, userId: String(b.userId || "") } } });
      if (!target || target.role === "owner") return fail("invalid_target");
      if (target.role === "admin" && membership.role !== "owner") return fail("forbidden", 403);
      await prisma.serverMember.delete({ where: { id: target.id } });
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      if (membership.role !== "owner") return fail("forbidden", 403);
      await prisma.gameServer.delete({ where: { id: server.id } });
      return NextResponse.json({ ok: true });
    }
    default:
      return fail("bad_action");
  }
}
