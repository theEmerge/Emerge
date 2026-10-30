import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { notify } from "@/lib/notifications";

type Ctx = { params: { id: string } };

// Poster only: who applied.
export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const job = await prisma.job.findUnique({ where: { id: params.id }, select: { posterId: true } });
  if (!job) return fail("not_found", 404);
  if (job.posterId !== me.id) return fail("forbidden", 403);
  const applications = await prisma.jobApplication.findMany({
    where: { jobId: params.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { ...userSelect, proProfile: { select: { headline: true } } } } },
  });
  return NextResponse.json({ applications });
}

// Apply with an optional note.
export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job || !job.open) return fail("not_found", 404);
  if (job.posterId === me.id) return fail("own_job");
  const b = await readJson(req);
  try {
    await prisma.jobApplication.create({ data: { jobId: job.id, userId: me.id, note: clean(b.note, 1000) || null } });
  } catch {
    return fail("already_applied", 409);
  }
  await notify({ recipientId: job.posterId, actorId: me.id, type: "JOB_APPLICATION" });
  return NextResponse.json({ applied: true });
}

// Poster only: close or reopen.
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const b = await readJson(req);
  const res = await prisma.job.updateMany({
    where: { id: params.id, posterId: me.id },
    data: { open: b.open === true },
  });
  if (!res.count) return fail("not_found", 404);
  return NextResponse.json({ open: b.open === true });
}
