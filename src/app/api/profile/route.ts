import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function validCloudinaryUrl(url: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const expectedPrefix = cloudName ? `https://res.cloudinary.com/${cloudName}/` : null;
  return !expectedPrefix || url.startsWith(expectedPrefix);
}

// Updates the current user's profile photo and/or banner. The client
// uploads the image first via POST /api/uploads (same as post images) and
// sends the resulting URL here - this route never touches raw bytes,
// same pattern as post creation.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { avatarUrl, bannerUrl, bio, name, handle } = await req.json();
  const data: { avatarUrl?: string; bannerUrl?: string; bio?: string; name?: string; handle?: string } = {};

  if (name !== undefined) {
    const n = typeof name === "string" ? name.trim() : "";
    if (n.length < 1 || n.length > 50) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    data.name = n;
  }
  if (handle !== undefined) {
    const h = typeof handle === "string" ? handle.trim().replace(/^@/, "") : "";
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(h)) return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
    data.handle = h;
  }

  if (avatarUrl !== undefined) {
    if (typeof avatarUrl !== "string" || !validCloudinaryUrl(avatarUrl)) {
      return NextResponse.json({ error: "invalid_avatar_url" }, { status: 400 });
    }
    data.avatarUrl = avatarUrl;
  }
  if (bannerUrl !== undefined) {
    if (typeof bannerUrl !== "string" || !validCloudinaryUrl(bannerUrl)) {
      return NextResponse.json({ error: "invalid_banner_url" }, { status: 400 });
    }
    data.bannerUrl = bannerUrl;
  }
  if (bio !== undefined) {
    if (typeof bio !== "string" || bio.length > 160) {
      return NextResponse.json({ error: "invalid_bio" }, { status: 400 });
    }
    data.bio = bio.trim();
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data });
  } catch (e) {
    // Unique constraint on handle
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "handle_taken" }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ...data });
}
