import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// List communities, with membership status and member counts, for the
// Explore screen and the composer's "post to a community" picker.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const communities = await prisma.community.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId }, select: { id: true } },
    },
  });

  return NextResponse.json({
    communities: communities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      memberCount: c._count.members,
      joined: c.members.length > 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, name, description } = await req.json();
  if (!slug?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const existing = await prisma.community.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "slug_taken" }, { status: 409 });

  const community = await prisma.community.create({
    data: { slug: slug.trim(), name: name.trim(), description: description?.trim() || null },
  });

  // Creating a community automatically joins you to it.
  await prisma.communityMembership.create({
    data: { userId: session.user.id, communityId: community.id },
  });

  return NextResponse.json({ community });
}
