import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { REPO_NAME } from "@/lib/dev";

// GET ?owner=handle&q=  -> repositories you can see, newest activity first.
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const url = new URL(req.url);
  const ownerHandle = url.searchParams.get("owner");
  const q = url.searchParams.get("q")?.trim();

  let ownerId: string | undefined;
  if (ownerHandle) {
    const u = await prisma.user.findUnique({ where: { handle: ownerHandle }, select: { id: true } });
    if (!u) return NextResponse.json({ repos: [] });
    ownerId = u.id;
  }

  const repos = await prisma.repo.findMany({
    where: {
      ...(ownerId ? { ownerId } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      OR: [{ isPublic: true }, { ownerId: me.id }, { collaborators: { some: { userId: me.id } } }],
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
    include: {
      owner: { select: userSelect },
      _count: { select: { issues: { where: { status: "OPEN" } }, pulls: { where: { status: "OPEN" } } } },
    },
  });

  return NextResponse.json({
    repos: repos.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isPublic: r.isPublic,
      pinned: r.pinned,
      updatedAt: r.updatedAt,
      owner: r.owner,
      openIssues: r._count.issues,
      openPulls: r._count.pulls,
    })),
  });
}

export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const name = clean(b.name, 60);
  if (!REPO_NAME.test(name) || name === "." || name === "..") return fail("bad_name");
  const description = clean(b.description, 300) || null;

  if ((await prisma.repo.count({ where: { ownerId: me.id } })) >= 100) return fail("too_many_repos");
  if (await prisma.repo.findUnique({ where: { ownerId_name: { ownerId: me.id, name } }, select: { id: true } })) {
    return fail("name_taken", 409);
  }

  const readme = `# ${name}\n\n${description ?? ""}\n`;
  const repo = await prisma.repo.create({
    data: {
      ownerId: me.id,
      name,
      description,
      isPublic: b.isPublic !== false,
      branches: { create: { name: "main" } },
      files: { create: { branch: "main", path: "README.md", content: readme } },
      commits: { create: { branch: "main", authorId: me.id, message: "Initial commit", paths: ["README.md"] } },
    },
  });
  return NextResponse.json({ repo: { id: repo.id, name: repo.name, owner: me.handle } });
}
