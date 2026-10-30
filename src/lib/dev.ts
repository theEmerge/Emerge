import { prisma } from "./prisma";
import { userSelect } from "./hub";

// ---------------------------------------------------------------------
// Repository access
// ---------------------------------------------------------------------

export async function loadRepo(ownerHandle: string, name: string, viewerId: string) {
  const owner = await prisma.user.findUnique({ where: { handle: ownerHandle }, select: userSelect });
  if (!owner) return null;
  const repo = await prisma.repo.findUnique({
    where: { ownerId_name: { ownerId: owner.id, name } },
    include: { collaborators: { select: { userId: true } } },
  });
  if (!repo) return null;
  const isOwner = repo.ownerId === viewerId;
  const isCollab = repo.collaborators.some((c) => c.userId === viewerId);
  if (!repo.isPublic && !isOwner && !isCollab) return null;
  return { repo, owner, isOwner, canWrite: isOwner || isCollab };
}
export type RepoCtx = NonNullable<Awaited<ReturnType<typeof loadRepo>>>;

export const REPO_NAME = /^[a-zA-Z0-9._-]{1,60}$/;
export const BRANCH_NAME = /^[a-zA-Z0-9._/-]{1,60}$/;
export const TAG_NAME = /^[a-zA-Z0-9._-]{1,40}$/;
export const MAX_FILE_CHARS = 200_000;
export const MAX_FILES_PER_BRANCH = 500;

export function validPath(p: unknown): p is string {
  if (typeof p !== "string" || !p || p.length > 200) return false;
  if (p.startsWith("/") || p.endsWith("/")) return false;
  return p.split("/").every((seg) => seg && seg !== "." && seg !== "..");
}

export async function branchExists(repoId: string, name: string) {
  return !!(await prisma.repoBranch.findUnique({ where: { repoId_name: { repoId, name } }, select: { id: true } }));
}

// Next issue / pull request number for a repo. Issues and PRs have separate
// counters; callers retry once on the unique-constraint race.
export async function nextIssueNumber(repoId: string) {
  const r = await prisma.issue.aggregate({ where: { repoId }, _max: { number: true } });
  return (r._max.number ?? 0) + 1;
}
export async function nextPullNumber(repoId: string) {
  const r = await prisma.pullRequest.aggregate({ where: { repoId }, _max: { number: true } });
  return (r._max.number ?? 0) + 1;
}

// ---------------------------------------------------------------------
// Line diff (longest common subsequence), for pull request review
// ---------------------------------------------------------------------

export type DiffRow = { t: " " | "+" | "-" | "~"; s: string };

export function diffLines(a: string, b: string): DiffRow[] | null {
  const A = a.split("\n");
  const B = b.split("\n");
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start++;
  let endA = A.length;
  let endB = B.length;
  while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) {
    endA--;
    endB--;
  }
  const a2 = A.slice(start, endA);
  const b2 = B.slice(start, endB);
  if (a2.length > 1500 || b2.length > 1500) return null;

  const m = a2.length;
  const n = b2.length;
  const w = n + 1;
  const dp = new Uint16Array((m + 1) * w);
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * w + j] = a2[i] === b2[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }

  const out: DiffRow[] = [];
  for (let k = 0; k < start; k++) out.push({ t: " ", s: A[k] });
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a2[i] === b2[j]) {
      out.push({ t: " ", s: a2[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      out.push({ t: "-", s: a2[i++] });
    } else {
      out.push({ t: "+", s: b2[j++] });
    }
  }
  while (i < m) out.push({ t: "-", s: a2[i++] });
  while (j < n) out.push({ t: "+", s: b2[j++] });
  for (let k = endA; k < A.length; k++) out.push({ t: " ", s: A[k] });
  return out;
}

// Keep changed lines plus `ctx` lines around them; fold the rest into "~" rows.
export function withContext(rows: DiffRow[], ctx = 3): DiffRow[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((r, idx) => {
    if (r.t === " ") return;
    for (let k = Math.max(0, idx - ctx); k <= Math.min(rows.length - 1, idx + ctx); k++) keep[k] = true;
  });
  const out: DiffRow[] = [];
  let skipped = 0;
  rows.forEach((r, idx) => {
    if (keep[idx]) {
      if (skipped) out.push({ t: "~", s: `${skipped} unchanged line${skipped === 1 ? "" : "s"}` });
      skipped = 0;
      out.push(r);
    } else skipped++;
  });
  if (skipped) out.push({ t: "~", s: `${skipped} unchanged line${skipped === 1 ? "" : "s"}` });
  return out;
}

export type FileChange = {
  path: string;
  status: "added" | "removed" | "modified";
  rows: DiffRow[];
  note?: string;
};

// What a pull request would change: only files touched by commits on the head
// branch since it was created, compared against the base branch. On merge the
// head version of each of those files wins.
export async function computeChanges(repoId: string, base: string, head: string): Promise<{ changes: FileChange[]; paths: string[] }> {
  const headBranch = await prisma.repoBranch.findUnique({ where: { repoId_name: { repoId, name: head } } });
  const commits = await prisma.commit.findMany({
    where: { repoId, branch: head, ...(headBranch ? { createdAt: { gt: headBranch.createdAt } } : {}) },
    select: { paths: true },
  });
  const touched = Array.from(new Set(commits.flatMap((c) => c.paths)));
  if (!touched.length) return { changes: [], paths: [] };

  const files = await prisma.repoFile.findMany({ where: { repoId, branch: { in: [base, head] }, path: { in: touched } } });
  const baseMap = new Map<string, string>();
  const headMap = new Map<string, string>();
  for (const f of files) (f.branch === head ? headMap : baseMap).set(f.path, f.content);

  const changes: FileChange[] = [];
  const paths: string[] = [];
  for (const path of touched.sort()) {
    const b = baseMap.get(path);
    const h = headMap.get(path);
    if (b === undefined && h === undefined) continue;
    if (b === h) continue;
    paths.push(path);
    if (b === undefined) {
      const lines = (h as string).split("\n");
      changes.push({ path, status: "added", rows: lines.slice(0, 300).map((s) => ({ t: "+", s })), note: lines.length > 300 ? `${lines.length - 300} more lines not shown` : undefined });
    } else if (h === undefined) {
      const lines = b.split("\n");
      changes.push({ path, status: "removed", rows: lines.slice(0, 300).map((s) => ({ t: "-", s })), note: lines.length > 300 ? `${lines.length - 300} more lines not shown` : undefined });
    } else {
      const full = diffLines(b, h);
      changes.push(
        full
          ? { path, status: "modified", rows: withContext(full) }
          : { path, status: "modified", rows: [], note: "File too large to show a line diff" }
      );
    }
  }
  return { changes, paths };
}
