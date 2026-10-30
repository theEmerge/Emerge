import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId: params.id, viewerId: session.user.id } },
    update: {},
    create: { storyId: params.id, viewerId: session.user.id },
  });

  return NextResponse.json({ viewed: true });
}
