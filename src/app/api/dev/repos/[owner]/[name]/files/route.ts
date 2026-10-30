import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";
import { branchExists, loadRepo, MAX_FILE_CHARS, MAX_FILES_PER_BRANCH, validPath } from "@/lib/dev";

type Ctx = { params: { owner: string; name: string } };

// GET ?branch=main            -> every file path on the branch
// GET ?branch=main&path=a/b.ts -> that file's contents as well
export async function GET(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const url = new URL(req.url);
  const branch = url.searchParams.get("branch") || "main";
  if (!(await branchExists(ctx.repo.id, branch))) return fail("branch_not_found", 404);

  const files = await prisma.repoFile.findMany({ where: { repoId: ctx.repo.id, branch }, select: { path: true }, orderBy: { path: "asc" } });
  const path = url.searchParams.get("path");
  let file: { path: string; content: string } | null = null;
  if (path) {
    const f = await prisma.repoFile.findUnique({ where: { repoId_branch_path: { repoId: ctx.repo.id, branch, path } } });
    if (f) file = { path: f.path, content: f.content };
  }
  return NextResponse.json({ files: files.map((f) => f.path), file });
}

// PUT { branch, path, content, message } -> create or update a file as one commit.
export async function PUT(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  if (!ctx.canWrite) return fail("forbidden", 403);

  const b = await readJson(req);
  const branch = clean(b.branch, 60) || "main";
  const path = typeof b.path === "string" ? b.path.trim() : "";
  if (!validPath(path)) return fail("bad_path");
  if (typeof b.content !== "string" || b.content.length > MAX_FILE_CHARS) return fail("content_too_large");
  if (!(await branchExists(ctx.repo.id, branch))) return fail("branch_not_found", 404);

  const repoId = ctx.repo.id;
  const existing = await prisma.repoFile.findUnique({ where: { repoId_branch_path: { repoId, branch, path } } });
  if (!existing && (await prisma.repoFile.count({ where: { repoId, branch } })) >= MAX_FILES_PER_BRANCH) return fail("too_many_files");
  if (existing && existing.content === b.content) return fail("no_changes");

  const message = clean(b.message, 200) || `${existing ? "Update" : "Add"} ${path}`;
  await prisma.$transaction([
    prisma.repoFile.upsert({
      where: { repoId_branch_path: { repoId, branch, path } },
      create: { repoId, branch, path, content: b.content },
      update: { content: b.content },
    }),
    prisma.commit.create({ data: { repoId, branch, authorId: me.id, message, paths: [path] } }),
    prisma.repo.update({ where: { id: repoId }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}

// DELETE ?branch=&path=&message= -> remove a file as one commit.
export async function DELETE(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  if (!ctx.canWrite) return fail("forbidden", 403);
  const url = new URL(req.url);
  const branch = url.searchParams.get("branch") || "main";
  const path = url.searchParams.get("path") || "";
  if (!validPath(path)) return fail("bad_path");
  const repoId = ctx.repo.id;
  const existing = await prisma.repoFile.findUnique({ where: { repoId_branch_path: { repoId, branch, path } } });
  if (!existing) return fail("not_found", 404);
  const message = clean(url.searchParams.get("message"), 200) || `Delete ${path}`;
  await prisma.$transaction([
    prisma.repoFile.delete({ where: { id: existing.id } }),
    prisma.commit.create({ data: { repoId, branch, authorId: me.id, message, paths: [path] } }),
    prisma.repo.update({ where: { id: repoId }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}
