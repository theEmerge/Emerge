import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";

export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;

  const b = await readJson(req);
  const kind = b.kind === "education" ? "education" : "work";
  const title = clean(b.title, 120);
  const org = clean(b.org, 120);
  const startYear = Number(b.startYear);
  const endYear = b.endYear === null || b.endYear === "" || b.endYear === undefined ? null : Number(b.endYear);
  const thisYear = new Date().getFullYear();
  if (!title || !org) return fail("missing_fields");
  if (!Number.isInteger(startYear) || startYear < 1950 || startYear > thisYear + 6) return fail("bad_start_year");
  if (endYear !== null && (!Number.isInteger(endYear) || endYear < startYear || endYear > thisYear + 6)) return fail("bad_end_year");

  const count = await prisma.proExperience.count({ where: { userId: me.id } });
  if (count >= 40) return fail("too_many_entries");

  const experience = await prisma.proExperience.create({
    data: { userId: me.id, kind, title, org, startYear, endYear, description: clean(b.description, 1000) || null },
  });
  return NextResponse.json({ experience });
}

export async function DELETE(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("missing_id");
  await prisma.proExperience.deleteMany({ where: { id, userId: me.id } });
  return NextResponse.json({ ok: true });
}
