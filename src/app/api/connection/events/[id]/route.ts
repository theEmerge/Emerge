import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";
import { isBlockedEitherWay } from "@/lib/blocks";

// POST { action: "going" | "not_going" }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);

  const event = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true, hostId: true } });
  if (!event) return fail("not_found", 404);
  if (await isBlockedEitherWay(me.id, event.hostId)) return fail("blocked", 403);

  if (b.action === "not_going") {
    // The host can't un-RSVP from their own event; they can delete it instead.
    if (event.hostId === me.id) return fail("host_cannot_leave");
    await prisma.eventRsvp.deleteMany({ where: { eventId: event.id, userId: me.id } });
    return NextResponse.json({ going: false });
  }
  if (b.action === "going") {
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: event.id, userId: me.id } },
      create: { eventId: event.id, userId: me.id },
      update: {},
    });
    return NextResponse.json({ going: true });
  }
  return fail("invalid_action");
}

// Host only.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const event = await prisma.event.findUnique({ where: { id: params.id }, select: { hostId: true } });
  if (!event) return fail("not_found", 404);
  if (event.hostId !== me.id) return fail("forbidden", 403);
  await prisma.event.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
