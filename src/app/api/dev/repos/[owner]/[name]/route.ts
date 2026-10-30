import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { loadRepo } from "@/lib/dev";

type Ctx = { params: { owner: string; name: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const { repo, owner } = ctx;

  const [branches, collaborators, openIssues, openPulls, releases] = await Promise.all([
    prisma.repoBranch.findMany({ where: { repoId: repo.id }, orderBy: { createdAt: "asc" }, select: { name: true } }),
    prisma.repoCollaborator.findMany({ where: { repoId: repo.id }, include: { user: { select: userSelect } } }),
    prisma.issue.count({ where: { repoId: repo.id, status: "OPEN" } }),
    prisma.pullRequest.count({ where: { repoId: repo.id, status: "OPEN" } }),
    prisma.release.count({ where: { repoId: repo.id } }),
  ]);

  return NextResponse.json({
    repo: { id: repo.id, name: repo.name, description: repo.description, isPublic: repo.isPublic, pinned: repo.pinned, createdAt: repo.createdAt },
    owner,
    isOwner: ctx.isOwner,
    canWrite: ctx.canWrite,
    branches: branches.map((b) => b.name),
    collaborators: collaborators.map((c) => c.user),
    counts: { openIssues, openPulls, releases },
  });
}

// Owner only: pin, describe, change visibility, manage collaborators.
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  if (!ctx.isOwner) return fail("forbidden", 403);
  const b = await readJson(req);
  const repoId = ctx.repo.id;

  if (typeof b.addCollaborator === "string") {
    const handle = b.addCollaborator.trim().replace(/^@/, "");
    const user = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (!user) return fail("user_not_found", 404);
    if (user.id === me.id) return fail("already_owner");
    await prisma.repoCollaborator.upsert({
      where: { repoId_userId: { repoId, userId: user.id } },
      create: { repoId, userId: user.id },
      update: {},
    });
    return NextResponse.json({ ok: true });
  }
  if (typeof b.removeCollaborator === "string") {
    await prisma.repoCollaborator.deleteMany({ where: { repoId, userId: b.removeCollaborator } });
    return NextResponse.json({ ok: true });
  }

  const data: { pinned?: boolean; description?: string | null; isPublic?: boolean } = {};
  if (typeof b.pinned === "boolean") {
    if (b.pinned && (await prisma.repo.count({ where: { ownerId: me.id, pinned: true } })) >= 6) return fail("too_many_pinned");
    data.pinned = b.pinned;
  }
  if (typeof b.description === "string") data.description = clean(b.description, 300) || null;
  if (typeof b.isPublic === "boolean") data.isPublic = b.isPublic;
  await prisma.repo.update({ where: { id: repoId }, data });
  return NextResponse.json({ ok: true });
}

// Owner only: DELETE ?confirm=<repo name>
export async function DELETE(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  if (!ctx.isOwner) return fail("forbidden", 403);
  if (new URL(req.url).searchParams.get("confirm") !== ctx.repo.name) return fail("confirm_name");
  await prisma.repo.delete({ where: { id: ctx.repo.id } });
  return NextResponse.json({ ok: true });
}
