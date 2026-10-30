import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { clean, cleanUrl, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "company";
}

export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const companies = await prisma.company.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    take: 60,
    include: { _count: { select: { jobs: { where: { open: true } } } } },
  });
  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      about: c.about,
      location: c.location,
      openJobs: c._count.jobs,
      isMine: c.ownerId === me.id,
    })),
  });
}

export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const name = clean(b.name, 80);
  if (!name) return fail("missing_fields");

  const base = slugify(name);
  const taken = await prisma.company.findUnique({ where: { slug: base } });
  const slug = taken ? `${base}-${randomBytes(2).toString("hex")}` : base;
  const company = await prisma.company.create({
    data: {
      slug,
      name,
      ownerId: me.id,
      about: clean(b.about, 2000) || null,
      website: cleanUrl(b.website),
      location: clean(b.location, 100) || null,
    },
  });
  return NextResponse.json({ company });
}
