import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { isBlockedEitherWay } from "@/lib/blocks";

type Ctx = { params: { handle: string } };

// Developer profile: pinned projects, public repos and 90 days of commits.
export async function GET(_req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const user = await prisma.user.findUnique({ where: { handle: params.handle }, select: { ...userSelect, bio: true } });
  if (!user) return fail("not_found", 404);
  if (await isBlockedEitherWay(me.id, user.id)) return fail("not_found", 404);

  const self = me.id === user.id;
  const visible = self ? {} : { OR: [{ isPublic: true }, { collaborators: { some: { userId: me.id } } }] };
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);

  const [repos, commits, mergedPulls, openedIssues] = await Promise.all([
    prisma.repo.findMany({
      where: { ownerId: user.id, ...visible },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { issues: { where: { status: "OPEN" } }, pulls: { where: { status: "OPEN" } } } } },
    }),
    prisma.commit.findMany({
      where: { authorId: user.id, createdAt: { gte: since }, repo: self ? {} : { isPublic: true } },
      select: { createdAt: true },
    }),
    prisma.pullRequest.count({ where: { authorId: user.id, status: "MERGED", repo: self ? {} : { isPublic: true } } }),
    prisma.issue.count({ where: { authorId: user.id, repo: self ? {} : { isPublic: true } } }),
  ]);

  const days: Record<string, number> = {};
  for (const c of commits) {
    const day = c.createdAt.toISOString().slice(0, 10);
    days[day] = (days[day] || 0) + 1;
  }

  const shape = (r: (typeof repos)[number]) => ({
    id: r.id, name: r.name, description: r.description, isPublic: r.isPublic, pinned: r.pinned, updatedAt: r.updatedAt,
    openIssues: r._count.issues, openPulls: r._count.pulls,
  });

  return NextResponse.json({
    user,
    pinned: repos.filter((r) => r.pinned).map(shape),
    repos: repos.map(shape),
    stats: { commits90: commits.length, mergedPulls, issues: openedIssues, repos: repos.length },
    days,
  });
}
