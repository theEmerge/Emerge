import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, cleanUrl, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { blockedUserIds } from "@/lib/blocks";

// GET ?scope=upcoming|going|hosting -> events soonest first.
//   upcoming: everything that hasn't ended yet
//   going:    ones you RSVP'd to
//   hosting:  ones you created
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const scope = new URL(req.url).searchParams.get("scope") || "upcoming";
  const blocked = await blockedUserIds(me.id);
  const now = new Date();
  // Still "upcoming" for 3 hours after the start if no end time was set.
  const cutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      hostId: scope === "hosting" ? me.id : { notIn: blocked },
      ...(scope === "going" ? { rsvps: { some: { userId: me.id } } } : {}),
      OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: cutoff } }],
    },
    orderBy: { startsAt: "asc" },
    take: 50,
    include: { host: { select: userSelect }, rsvps: { select: { userId: true } } },
  });

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      isOnline: e.isOnline,
      link: e.link,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      host: e.host,
      goingCount: e.rsvps.length,
      going: e.rsvps.some((r) => r.userId === me.id),
      isMine: e.hostId === me.id,
    })),
  });
}

// POST { title, description, location, isOnline, link, startsAt, endsAt }
export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);

  const title = clean(b.title, 120);
  if (!title) return fail("title_required");
  const startsAt = new Date(String(b.startsAt ?? ""));
  if (isNaN(startsAt.getTime())) return fail("invalid_date");
  if (startsAt.getTime() < Date.now() - 60 * 1000) return fail("date_in_past");
  let endsAt: Date | null = null;
  if (b.endsAt) {
    endsAt = new Date(String(b.endsAt));
    if (isNaN(endsAt.getTime()) || endsAt <= startsAt) return fail("invalid_end");
  }
  const isOnline = b.isOnline === true;
  const link = cleanUrl(b.link);
  const location = clean(b.location, 120) || null;
  if (!isOnline && !location) return fail("location_required");

  const event = await prisma.event.create({
    data: {
      hostId: me.id,
      title,
      description: clean(b.description, 3000),
      location,
      isOnline,
      link,
      startsAt,
      endsAt,
      // The host is going to their own event.
      rsvps: { create: { userId: me.id } },
    },
  });
  return NextResponse.json({ id: event.id });
}
