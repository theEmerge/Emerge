import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, cleanUrl, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";

type Ctx = { params: { slug: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    include: {
      owner: { select: userSelect },
      jobs: { where: { open: true }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, location: true, jobType: true, createdAt: true } },
    },
  });
  if (!company) return fail("not_found", 404);
  const { ownerId, ...rest } = company;
  return NextResponse.json({ company: { ...rest, isMine: ownerId === me.id } });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const res = await prisma.company.updateMany({
    where: { slug: params.slug, ownerId: me.id },
    data: { about: clean(b.about, 2000) || null, website: cleanUrl(b.website), location: clean(b.location, 100) || null },
  });
  if (!res.count) return fail("not_found", 404);
  return NextResponse.json({ ok: true });
}
