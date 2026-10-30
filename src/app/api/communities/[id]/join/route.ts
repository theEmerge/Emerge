import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const communityId = params.id;

  const existing = await prisma.communityMembership.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });

  if (existing) {
    await prisma.communityMembership.delete({ where: { id: existing.id } });
    return NextResponse.json({ joined: false });
  }

  await prisma.communityMembership.create({ data: { userId, communityId } });
  return NextResponse.json({ joined: true });
}
