import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { computeChanges, loadRepo } from "@/lib/dev";

type Ctx = { params: { owner: string; name: string; number: string } };

async function loadPull(ctx: NonNullable<Awaited<ReturnType<typeof loadRepo>>>, number: string) {
  const n = parseInt(number, 10);
  if (!Number.isInteger(n)) return null;
  return prisma.pullRequest.findUnique({ where: { repoId_number: { repoId: ctx.repo.id, number: n } } });
}

export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const pull = await loadPull(ctx, params.number);
  if (!pull) return fail("not_found", 404);

  const [author, comments, diff] = await Promise.all([
    prisma.user.findUnique({ where: { id: pull.authorId }, select: userSelect }),
    prisma.devComment.findMany({ where: { pullId: pull.id }, orderBy: { createdAt: "asc" }, include: { author: { select: userSelect } } }),
    pull.status === "OPEN" ? computeChanges(ctx.repo.id, pull.baseBranch, pull.headBranch) : Promise.resolve({ changes: [], paths: [] }),
  ]);

  return NextResponse.json({
    pull: {
      number: pull.number, title: pull.title, body: pull.body, status: pull.status,
      baseBranch: pull.baseBranch, headBranch: pull.headBranch, createdAt: pull.createdAt, closedAt: pull.closedAt, author,
    },
    comments,
    changes: diff.changes,
    canWrite: ctx.canWrite,
  });
}

// POST { action: "comment" | "merge" | "close" | "reopen", body? }
export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const pull = await loadPull(ctx, params.number);
  if (!pull) return fail("not_found", 404);
  const b = await readJson(req);
  const repoId = ctx.repo.id;

  switch (b.action) {
    case "comment": {
      const body = clean(b.body, 3000);
      if (!body) return fail("empty");
      const comment = await prisma.devComment.create({
        data: { authorId: me.id, pullId: pull.id, body },
        include: { author: { select: userSelect } },
      });
      return NextResponse.json({ comment });
    }
    case "merge": {
      if (!ctx.canWrite) return fail("forbidden", 403);
      if (pull.status !== "OPEN") return fail("not_open");
      const { paths } = await computeChanges(repoId, pull.baseBranch, pull.headBranch);
      const headFiles = await prisma.repoFile.findMany({ where: { repoId, branch: pull.headBranch, path: { in: paths } } });
      const headMap = new Map(headFiles.map((f) => [f.path, f.content]));
      const ops = [];
      for (const path of paths) {
        const content = headMap.get(path);
        if (content === undefined) {
          ops.push(prisma.repoFile.deleteMany({ where: { repoId, branch: pull.baseBranch, path } }));
        } else {
          ops.push(
            prisma.repoFile.upsert({
              where: { repoId_branch_path: { repoId, branch: pull.baseBranch, path } },
              create: { repoId, branch: pull.baseBranch, path, content },
              update: { content },
            })
          );
        }
      }
      await prisma.$transaction([
        ...ops,
        prisma.commit.create({
          data: { repoId, branch: pull.baseBranch, authorId: me.id, message: `Merge pull request #${pull.number} from ${pull.headBranch}`, paths },
        }),
        prisma.pullRequest.update({ where: { id: pull.id }, data: { status: "MERGED", closedAt: new Date() } }),
        prisma.repo.update({ where: { id: repoId }, data: { updatedAt: new Date() } }),
      ]);
      return NextResponse.json({ status: "MERGED" });
    }
    case "close": {
      if (!ctx.canWrite && pull.authorId !== me.id) return fail("forbidden", 403);
      if (pull.status !== "OPEN") return fail("not_open");
      await prisma.pullRequest.update({ where: { id: pull.id }, data: { status: "CLOSED", closedAt: new Date() } });
      return NextResponse.json({ status: "CLOSED" });
    }
    case "reopen": {
      if (!ctx.canWrite) return fail("forbidden", 403);
      if (pull.status !== "CLOSED") return fail("not_closed");
      await prisma.pullRequest.update({ where: { id: pull.id }, data: { status: "OPEN", closedAt: null } });
      return NextResponse.json({ status: "OPEN" });
    }
    default:
      return fail("bad_action");
  }
}
