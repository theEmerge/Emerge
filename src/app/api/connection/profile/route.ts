import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, cleanUrl, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { connectedIds, connectionBetween } from "@/lib/connections";
import { isBlockedEitherWay } from "@/lib/blocks";

// GET ?handle=  -> a professional profile (empty shell if they haven't set one up).
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const handle = new URL(req.url).searchParams.get("handle") || me.handle;

  const user = await prisma.user.findUnique({ where: { handle }, select: { ...userSelect, bio: true } });
  if (!user) return fail("not_found", 404);
  if (await isBlockedEitherWay(me.id, user.id)) return fail("not_found", 404);

  const [profile, experiences, endorsements, recommendations, conn, theirConnections, myConnections] = await Promise.all([
    prisma.proProfile.findUnique({ where: { userId: user.id } }),
    prisma.proExperience.findMany({ where: { userId: user.id }, orderBy: [{ startYear: "desc" }, { createdAt: "desc" }] }),
    prisma.proEndorsement.findMany({ where: { targetId: user.id }, select: { skill: true, endorserId: true } }),
    prisma.proRecommendation.findMany({
      where: { targetId: user.id },
      orderBy: { createdAt: "desc" },
      include: { author: { select: userSelect } },
    }),
    me.id === user.id ? null : connectionBetween(me.id, user.id),
    connectedIds(user.id),
    connectedIds(me.id),
  ]);

  const mine = new Set(myConnections);
  const mutualIds = theirConnections.filter((id) => mine.has(id) && id !== me.id);
  const mutual = mutualIds.length
    ? await prisma.user.findMany({ where: { id: { in: mutualIds.slice(0, 6) } }, select: userSelect })
    : [];

  const endorsementCounts: Record<string, { count: number; byMe: boolean }> = {};
  for (const e of endorsements) {
    const entry = (endorsementCounts[e.skill] ||= { count: 0, byMe: false });
    entry.count += 1;
    if (e.endorserId === me.id) entry.byMe = true;
  }

  let status: "self" | "none" | "connected" | "pending_out" | "pending_in" = "none";
  if (me.id === user.id) status = "self";
  else if (conn?.status === "ACCEPTED") status = "connected";
  else if (conn) status = conn.requesterId === me.id ? "pending_out" : "pending_in";

  return NextResponse.json({
    user,
    profile,
    experiences,
    endorsements: endorsementCounts,
    recommendations,
    status,
    connectionId: conn?.id ?? null,
    connectionCount: theirConnections.length,
    mutual,
    mutualCount: mutualIds.length,
  });
}

// PUT -> edit your own professional profile.
export async function PUT(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;

  const body = await readJson(req);
  const rawSkills = Array.isArray(body.skills) ? body.skills : [];
  const skills = Array.from(new Set(rawSkills.map((s) => clean(s, 40)).filter(Boolean))).slice(0, 20);
  const data = {
    headline: clean(body.headline, 120) || null,
    about: clean(body.about, 2000) || null,
    location: clean(body.location, 80) || null,
    skills,
    portfolioUrl: cleanUrl(body.portfolioUrl),
    openToWork: body.openToWork === true,
  };
  const profile = await prisma.proProfile.upsert({
    where: { userId: me.id },
    create: { userId: me.id, ...data },
    update: data,
  });
  // Endorsements for skills that were removed no longer apply.
  await prisma.proEndorsement.deleteMany({ where: { targetId: me.id, skill: { notIn: skills } } });
  return NextResponse.json({ profile });
}
