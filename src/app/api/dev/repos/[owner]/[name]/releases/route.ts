import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { loadRepo, TAG_NAME } from "@/lib/dev";

type Ctx = { params: { owner: string; name: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const releases = await prisma.release.findMany({
    where: { repoId: ctx.repo.id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: userSelect } },
  });
  return NextResponse.json({ releases, canWrite: ctx.canWrite });
}

export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  if (!ctx.canWrite) return fail("forbidden", 403);
  const b = await readJson(req);
  const tag = clean(b.tag, 40);
  const title = clean(b.title, 120) || tag;
  if (!TAG_NAME.test(tag)) return fail("bad_tag");
  try {
    const release = await prisma.release.create({
      data: { repoId: ctx.repo.id, authorId: me.id, tag, title, notes: clean(b.notes, 5000) || null },
    });
    return NextResponse.json({ release });
  } catch {
    return fail("tag_taken", 409);
  }
}
