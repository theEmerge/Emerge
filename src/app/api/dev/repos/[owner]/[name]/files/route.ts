import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized } from "@/lib/hub";
import { branchExists, loadRepo, MAX_FILE_CHARS, MAX_FILES_PER_BRANCH, MAX_UPLOAD_CHARS, MAX_UPLOAD_FILES, validPath } from "@/lib/dev";

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

// POST { branch, message, files: [{ path, content }] } -> add or update MANY files as ONE commit
// (drag-and-drop / folder upload). Files whose content didn't change are skipped.
export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  if (!ctx.canWrite) return fail("forbidden", 403);

  const b = await readJson(req);
  const branch = clean(b.branch, 60) || "main";
  if (!(await branchExists(ctx.repo.id, branch))) return fail("branch_not_found", 404);
  const list = Array.isArray(b.files) ? b.files : [];
  if (list.length === 0) return fail("no_files");
  if (list.length > MAX_UPLOAD_FILES) return fail("too_many_files_at_once");

  // validate everything first; the last entry wins if a path appears twice
  const incoming = new Map<string, string>();
  let total = 0;
  for (const f of list) {
    const path = f && typeof f.path === "string" ? f.path.trim() : "";
    if (!validPath(path)) return fail("bad_path");
    if (typeof f.content !== "string" || f.content.length > MAX_FILE_CHARS) return fail("content_too_large");
    if (f.content.includes("\u0000")) return fail("bad_content"); // Postgres text can't hold NUL
    total += f.content.length;
    incoming.set(path, f.content);
  }
  if (total > MAX_UPLOAD_CHARS) return fail("upload_too_large");

  const repoId = ctx.repo.id;
  const existing = await prisma.repoFile.findMany({
    where: { repoId, branch, path: { in: Array.from(incoming.keys()) } },
    select: { id: true, path: true, content: true },
  });
  const have = new Map(existing.map((e) => [e.path, e]));
  const toCreate: { path: string; content: string }[] = [];
  const toUpdate: { id: string; path: string; content: string }[] = [];
  incoming.forEach((content, path) => {
    const e = have.get(path);
    if (!e) toCreate.push({ path, content });
    else if (e.content !== content) toUpdate.push({ id: e.id, path, content });
  });
  if (toCreate.length === 0 && toUpdate.length === 0) return fail("no_changes");
  if (toCreate.length && (await prisma.repoFile.count({ where: { repoId, branch } })) + toCreate.length > MAX_FILES_PER_BRANCH) return fail("too_many_files");

  const changed = [...toCreate.map((f) => f.path), ...toUpdate.map((f) => f.path)];
  const fallback = changed.length === 1 ? `${toCreate.length ? "Add" : "Update"} ${changed[0]}` : `${toCreate.length ? "Add" : "Update"} ${changed.length} files`;
  const message = clean(b.message, 200) || fallback;
  await prisma.$transaction([
    ...(toCreate.length ? [prisma.repoFile.createMany({ data: toCreate.map((f) => ({ repoId, branch, path: f.path, content: f.content })) })] : []),
    ...toUpdate.map((f) => prisma.repoFile.update({ where: { id: f.id }, data: { content: f.content } })),
    prisma.commit.create({ data: { repoId, branch, authorId: me.id, message, paths: changed.slice(0, 200) } }),
    prisma.repo.update({ where: { id: repoId }, data: { updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true, added: toCreate.length, updated: toUpdate.length, unchanged: incoming.size - changed.length });
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
