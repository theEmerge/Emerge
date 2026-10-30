import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";
import { BRANCH_NAME, branchExists, loadRepo } from "@/lib/dev";

type Ctx = { params: { owner: string; name: string } };

// POST { name, from } -> new branch with a copy of `from`'s files.
export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  if (!ctx.canWrite) return fail("forbidden", 403);

  const b = await readJson(req);
  const name = clean(b.name, 60);
  const from = clean(b.from, 60) || "main";
  if (!BRANCH_NAME.test(name) || name.startsWith("/") || name.endsWith("/") || name.includes("//")) return fail("bad_name");
  const repoId = ctx.repo.id;
  if (!(await branchExists(repoId, from))) return fail("branch_not_found", 404);
  if (await branchExists(repoId, name)) return fail("name_taken", 409);
  if ((await prisma.repoBranch.count({ where: { repoId } })) >= 30) return fail("too_many_branches");

  const source = await prisma.repoFile.findMany({ where: { repoId, branch: from }, select: { path: true, content: true } });
  await prisma.$transaction([
    prisma.repoBranch.create({ data: { repoId, name } }),
    prisma.repoFile.createMany({ data: source.map((f) => ({ repoId, branch: name, path: f.path, content: f.content })) }),
    prisma.commit.create({ data: { repoId, branch: name, authorId: me.id, message: `Create branch ${name} from ${from}`, paths: [] } }),
  ]);
  return NextResponse.json({ name });
}
