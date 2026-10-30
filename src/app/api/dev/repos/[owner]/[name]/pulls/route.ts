import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { branchExists, loadRepo, nextPullNumber } from "@/lib/dev";
import { notify } from "@/lib/notifications";

type Ctx = { params: { owner: string; name: string } };

export async function GET(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const status = new URL(req.url).searchParams.get("status");
  const pulls = await prisma.pullRequest.findMany({
    where: { repoId: ctx.repo.id, ...(status && status !== "ALL" ? { status } : {}) },
    orderBy: { number: "desc" },
    take: 100,
    include: { author: { select: userSelect }, _count: { select: { comments: true } } },
  });
  return NextResponse.json({
    pulls: pulls.map((p) => ({
      number: p.number, title: p.title, status: p.status, baseBranch: p.baseBranch, headBranch: p.headBranch,
      createdAt: p.createdAt, author: p.author, comments: p._count.comments,
    })),
  });
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
  const title = clean(b.title, 150);
  const baseBranch = clean(b.base, 60) || "main";
  const headBranch = clean(b.head, 60);
  const repoId = ctx.repo.id;
  if (!title || !headBranch) return fail("missing_fields");
  if (baseBranch === headBranch) return fail("same_branch");
  if (!(await branchExists(repoId, baseBranch)) || !(await branchExists(repoId, headBranch))) return fail("branch_not_found", 404);
  if (await prisma.pullRequest.findFirst({ where: { repoId, baseBranch, headBranch, status: "OPEN" }, select: { id: true } })) {
    return fail("already_open", 409);
  }

  const data = { repoId, title, body: clean(b.body, 5000) || null, authorId: me.id, baseBranch, headBranch };
  let number = await nextPullNumber(repoId);
  let pull;
  try {
    pull = await prisma.pullRequest.create({ data: { ...data, number } });
  } catch {
    number = await nextPullNumber(repoId); // lost a race for the number; try once more
    pull = await prisma.pullRequest.create({ data: { ...data, number } });
  }
  await notify({ recipientId: ctx.repo.ownerId, actorId: me.id, type: "PULL_REQUEST" });
  return NextResponse.json({ number: pull.number });
}
