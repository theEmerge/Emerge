import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helpful marks are community-scoped and NOT hidden - this route returns
// the live count directly, unlike /api/posts/[id]/likes which requires a
// separate reveal step. Different metric, different rules, on purpose.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const postId = params.id;

  const existing = await prisma.helpfulMark.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    await prisma.helpfulMark.delete({ where: { id: existing.id } });
  } else {
    await prisma.helpfulMark.create({ data: { userId, postId } });
  }

  const count = await prisma.helpfulMark.count({ where: { postId } });
  return NextResponse.json({ marked: !existing, count });
}
