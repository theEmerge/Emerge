import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionUser, unauthorized } from "@/lib/hub";

const DAY = 24 * 60 * 60 * 1000;

// Buckets timestamps into `days` daily counts, oldest first, ending today.
function buckets(dates: Date[], days: number): number[] {
  const out = new Array(days).fill(0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const first = start.getTime() - (days - 1) * DAY;
  for (const d of dates) {
    const i = Math.floor((d.getTime() - first) / DAY);
    if (i >= 0 && i < days) out[i] += 1;
  }
  return out;
}

// GET ?hub=connection|developer -> the extra data the hub home dashboards show.
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const hub = new URL(req.url).searchParams.get("hub");

  if (hub === "connection") {
    const [profile, experiences] = await Promise.all([
      prisma.proProfile.findUnique({ where: { userId: me.id } }),
      prisma.proExperience.count({ where: { userId: me.id } }),
    ]);
    const checks: [string, boolean][] = [
      ["Add a headline", !!profile?.headline?.trim()],
      ["Write an about section", !!profile?.about?.trim()],
      ["Add your location", !!profile?.location?.trim()],
      ["List at least 3 skills", (profile?.skills?.length ?? 0) >= 3],
      ["Add featured work or a portfolio link", !!profile?.portfolioUrl],
      ["Add work or education", experiences > 0],
    ];
    const done = checks.filter(([, ok]) => ok).length;
    return NextResponse.json({
      strength: {
        percent: Math.round((done / checks.length) * 100),
        next: checks.find(([, ok]) => !ok)?.[0] ?? null,
      },
    });
  }

  if (hub === "developer") {
    const since10 = new Date(Date.now() - 10 * DAY);
    const since12 = new Date(Date.now() - 12 * DAY);
    const repos = await prisma.repo.findMany({
      where: { ownerId: me.id },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, name: true, isPublic: true, updatedAt: true },
    });
    const ids = repos.map((r) => r.id);
    const [commits, issues, pulls, myCommits] = await Promise.all([
      ids.length ? prisma.commit.findMany({ where: { repoId: { in: ids }, createdAt: { gte: since10 } }, select: { repoId: true, createdAt: true } }) : [],
      ids.length ? prisma.issue.groupBy({ by: ["repoId"], where: { repoId: { in: ids }, status: "OPEN" }, _count: { _all: true } }) : [],
      ids.length ? prisma.pullRequest.groupBy({ by: ["repoId"], where: { repoId: { in: ids }, status: "OPEN" }, _count: { _all: true } }) : [],
      prisma.commit.findMany({ where: { authorId: me.id, createdAt: { gte: since12 } }, select: { createdAt: true } }),
    ]);

    // Release runway for the repo you touched most recently.
    let runway: { repo: string; percent: number; steps: { label: string; detail: string; state: "done" | "active" | "next" }[] } | null = null;
    const latest = repos[0];
    if (latest) {
      const [commitCount, prOpen, prMerged, releases] = await Promise.all([
        prisma.commit.count({ where: { repoId: latest.id } }),
        prisma.pullRequest.count({ where: { repoId: latest.id, status: "OPEN" } }),
        prisma.pullRequest.count({ where: { repoId: latest.id, status: "MERGED" } }),
        prisma.release.count({ where: { repoId: latest.id } }),
      ]);
      const raw = [
        { label: "Create", detail: "Repository ready", done: true },
        { label: "Commit", detail: commitCount ? `${commitCount} commit${commitCount === 1 ? "" : "s"}` : "Push your first commit", done: commitCount > 0 },
        { label: "Review", detail: prMerged ? `${prMerged} merged` : prOpen ? `${prOpen} open pull request${prOpen === 1 ? "" : "s"}` : "Open a pull request", done: prMerged > 0 },
        { label: "Release", detail: releases ? `${releases} published` : "Publish a release", done: releases > 0 },
      ];
      const activeIdx = raw.findIndex((s) => !s.done);
      runway = {
        repo: latest.name,
        percent: Math.round((raw.filter((s) => s.done).length / raw.length) * 100),
        steps: raw.map((s, i) => ({ label: s.label, detail: s.detail, state: s.done ? "done" : i === activeIdx ? "active" : "next" })),
      };
    }

    return NextResponse.json({
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        isPublic: r.isPublic,
        spark: buckets(commits.filter((c) => c.repoId === r.id).map((c) => c.createdAt), 10),
        openIssues: issues.find((i) => i.repoId === r.id)?._count._all ?? 0,
        openPulls: pulls.find((p) => p.repoId === r.id)?._count._all ?? 0,
      })),
      pulse: { series: buckets(myCommits.map((c) => c.createdAt), 12), total: myCommits.length },
      runway,
    });
  }

  return NextResponse.json({ error: "invalid_hub" }, { status: 400 });
}
