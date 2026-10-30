import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { loadRepo, nextIssueNumber } from "@/lib/dev";
import { notify } from "@/lib/notifications";

type Ctx = { params: { owner: string; name: string } };

// Returns every issue (up to 200); the list and the board both filter client-side.
export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const issues = await prisma.issue.findMany({
    where: { repoId: ctx.repo.id },
    orderBy: { number: "desc" },
    take: 200,
    include: { author: { select: userSelect }, _count: { select: { comments: true } } },
  });
  return NextResponse.json({
    issues: issues.map((i) => ({
      number: i.number, title: i.title, status: i.status, col: i.col, createdAt: i.createdAt, author: i.author, comments: i._count.comments,
    })),
    canWrite: ctx.canWrite,
  });
}

// Anyone who can see the repo can open an issue.
export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const b = await readJson(req);
  const title = clean(b.title, 150);
  if (!title) return fail("missing_fields");

  const data = { repoId: ctx.repo.id, title, body: clean(b.body, 5000) || null, authorId: me.id };
  let issue;
  try {
    issue = await prisma.issue.create({ data: { ...data, number: await nextIssueNumber(ctx.repo.id) } });
  } catch {
    issue = await prisma.issue.create({ data: { ...data, number: await nextIssueNumber(ctx.repo.id) } });
  }
  await notify({ recipientId: ctx.repo.ownerId, actorId: me.id, type: "ISSUE" });
  return NextResponse.json({ number: issue.number });
}
