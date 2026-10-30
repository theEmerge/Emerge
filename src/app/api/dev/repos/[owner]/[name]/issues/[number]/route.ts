import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { loadRepo } from "@/lib/dev";

type Ctx = { params: { owner: string; name: string; number: string } };

async function loadIssue(repoId: string, number: string) {
  const n = parseInt(number, 10);
  if (!Number.isInteger(n)) return null;
  return prisma.issue.findUnique({ where: { repoId_number: { repoId, number: n } } });
}

export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const issue = await loadIssue(ctx.repo.id, params.number);
  if (!issue) return fail("not_found", 404);
  const [author, comments] = await Promise.all([
    prisma.user.findUnique({ where: { id: issue.authorId }, select: userSelect }),
    prisma.devComment.findMany({ where: { issueId: issue.id }, orderBy: { createdAt: "asc" }, include: { author: { select: userSelect } } }),
  ]);
  return NextResponse.json({
    issue: { number: issue.number, title: issue.title, body: issue.body, status: issue.status, col: issue.col, createdAt: issue.createdAt, author },
    comments,
    canWrite: ctx.canWrite,
    canClose: ctx.canWrite || issue.authorId === me.id,
  });
}

// PATCH { status?: "OPEN" | "CLOSED", col?: "todo" | "doing" | "done" }
// Closing sends an issue to Done; reopening sends it back to To do.
// Moving between board columns is for people with write access.
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const issue = await loadIssue(ctx.repo.id, params.number);
  if (!issue) return fail("not_found", 404);
  const b = await readJson(req);
  const data: { status?: string; col?: string } = {};

  if (b.status === "OPEN" || b.status === "CLOSED") {
    if (!ctx.canWrite && issue.authorId !== me.id) return fail("forbidden", 403);
    data.status = b.status;
    data.col = b.status === "CLOSED" ? "done" : "todo";
  }
  if (b.col === "todo" || b.col === "doing" || b.col === "done") {
    if (!ctx.canWrite) return fail("forbidden", 403);
    data.col = b.col;
    data.status = b.col === "done" ? "CLOSED" : "OPEN";
  }
  if (!data.status && !data.col) return fail("nothing_to_change");
  await prisma.issue.update({ where: { id: issue.id }, data });
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const issue = await loadIssue(ctx.repo.id, params.number);
  if (!issue) return fail("not_found", 404);
  const b = await readJson(req);
  const body = clean(b.body, 3000);
  if (!body) return fail("empty");
  const comment = await prisma.devComment.create({
    data: { authorId: me.id, issueId: issue.id, body },
    include: { author: { select: userSelect } },
  });
  return NextResponse.json({ comment });
}
