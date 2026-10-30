import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { connectedIds } from "@/lib/connections";
import { blockedUserIds } from "@/lib/blocks";

const PAGE = 20;
const authorSelect = { ...userSelect, proProfile: { select: { headline: true } } } as const;

// Strictly newest-first. scope=connections (default) shows you and your
// connections; scope=all shows everyone. Nothing is ranked or boosted.
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "connections";
  const cursor = url.searchParams.get("cursor");
  const blocked = await blockedUserIds(me.id);

  const authorFilter =
    scope === "all"
      ? { notIn: blocked }
      : { in: [me.id, ...(await connectedIds(me.id))].filter((id) => !blocked.includes(id)) };

  const rows = await prisma.proPost.findMany({
    where: { authorId: authorFilter },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { author: { select: authorSelect } },
  });
  const hasMore = rows.length > PAGE;
  const posts = rows.slice(0, PAGE);
  return NextResponse.json({ posts, nextCursor: hasMore ? posts[posts.length - 1].id : null });
}

export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  const b = await readJson(req);
  const text = clean(b.body, 3000);
  if (!text) return fail("empty");
  const post = await prisma.proPost.create({
    data: { authorId: me.id, body: text },
    include: { author: { select: authorSelect } },
  });
  return NextResponse.json({ post });
}

export async function DELETE(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("missing_id");
  await prisma.proPost.deleteMany({ where: { id, authorId: me.id } });
  return NextResponse.json({ ok: true });
}
