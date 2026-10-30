import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { connectedIds, connectionBetween } from "@/lib/connections";
import { blockedUserIds, isBlockedEitherWay } from "@/lib/blocks";
import { notify } from "@/lib/notifications";

const withHeadline = { proProfile: { select: { headline: true } } } as const;

// GET            -> your connections, pending requests, and people you may know
// GET ?q=name    -> people search
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const blocked = await blockedUserIds(me.id);
  const q = new URL(req.url).searchParams.get("q")?.trim();

  if (q) {
    const people = await prisma.user.findMany({
      where: {
        id: { notIn: [me.id, ...blocked] },
        OR: [{ name: { contains: q, mode: "insensitive" } }, { handle: { contains: q, mode: "insensitive" } }],
      },
      select: { ...userSelect, ...withHeadline },
      orderBy: { name: "asc" },
      take: 20,
    });
    return NextResponse.json({ people });
  }

  const rows = await prisma.proConnection.findMany({
    where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { ...userSelect, ...withHeadline } },
      addressee: { select: { ...userSelect, ...withHeadline } },
    },
  });

  const connections: unknown[] = [];
  const incoming: unknown[] = [];
  const outgoing: unknown[] = [];
  for (const r of rows) {
    const other = r.requesterId === me.id ? r.addressee : r.requester;
    if (blocked.includes(other.id)) continue;
    if (r.status === "ACCEPTED") connections.push({ id: r.id, user: other });
    else if (r.requesterId === me.id) outgoing.push({ id: r.id, user: other });
    else incoming.push({ id: r.id, user: other });
  }

  // People you may know: friends of your connections. Listed alphabetically -
  // nothing here is scored or ranked, the mutual count is just shown.
  const mine = await connectedIds(me.id);
  const known = new Set<string>([me.id, ...rows.flatMap((r) => [r.requesterId, r.addresseeId]), ...blocked]);
  let suggestions: unknown[] = [];
  if (mine.length) {
    const second = await prisma.proConnection.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: { in: mine } }, { addresseeId: { in: mine } }] },
      select: { requesterId: true, addresseeId: true },
      take: 500,
    });
    const mineSet = new Set(mine);
    const tally = new Map<string, number>();
    for (const r of second) {
      const other = mineSet.has(r.requesterId) ? r.addresseeId : r.requesterId;
      if (known.has(other)) continue;
      tally.set(other, (tally.get(other) || 0) + 1);
    }
    const ids = Array.from(tally.keys()).slice(0, 40);
    if (ids.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { ...userSelect, ...withHeadline },
        orderBy: { name: "asc" },
        take: 8,
      });
      suggestions = users.map((u) => ({ user: u, mutual: tally.get(u.id) || 0 }));
    }
  }

  return NextResponse.json({ connections, incoming, outgoing, suggestions });
}

// POST { action: "request" | "accept" | "decline" | "remove", userId }
export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;

  const b = await readJson(req);
  const userId = typeof b.userId === "string" ? b.userId : "";
  if (!userId || userId === me.id) return fail("invalid_user");
  if (await isBlockedEitherWay(me.id, userId)) return fail("blocked", 403);
  const existing = await connectionBetween(me.id, userId);

  switch (b.action) {
    case "request": {
      if (existing) return fail("already_exists", 409);
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!target) return fail("not_found", 404);
      await prisma.proConnection.create({ data: { requesterId: me.id, addresseeId: userId } });
      await notify({ recipientId: userId, actorId: me.id, type: "CONNECTION_REQUEST" });
      return NextResponse.json({ status: "pending_out" });
    }
    case "accept": {
      if (!existing || existing.status !== "PENDING" || existing.addresseeId !== me.id) return fail("no_request", 404);
      await prisma.proConnection.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
      await notify({ recipientId: userId, actorId: me.id, type: "CONNECTION_ACCEPTED" });
      return NextResponse.json({ status: "connected" });
    }
    case "decline":
    case "remove": {
      // Decline an incoming request, withdraw an outgoing one, or remove a connection.
      if (!existing) return NextResponse.json({ status: "none" });
      await prisma.proConnection.delete({ where: { id: existing.id } });
      return NextResponse.json({ status: "none" });
    }
    default:
      return fail("bad_action");
  }
}
