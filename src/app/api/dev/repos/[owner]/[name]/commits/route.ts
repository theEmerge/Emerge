import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { loadRepo } from "@/lib/dev";

type Ctx = { params: { owner: string; name: string } };

export async function GET(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const ctx = await loadRepo(params.owner, params.name, me.id);
  if (!ctx) return fail("not_found", 404);
  const branch = new URL(req.url).searchParams.get("branch") || "main";
  const commits = await prisma.commit.findMany({
    where: { repoId: ctx.repo.id, branch },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: userSelect } },
  });
  return NextResponse.json({
    commits: commits.map((c) => ({ id: c.id, message: c.message, paths: c.paths, createdAt: c.createdAt, author: c.author })),
  });
}
