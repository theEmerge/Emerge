import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireVerifiedEmail } from "@/lib/verified";
import { blockedUserIds } from "@/lib/blocks";

// Stories live for 24h (expiresAt), image-only. GET groups active
// (unexpired) stories by author - yourself first, then people you follow,
// each with newest-first stories and a flag for whether you've seen all
// of them yet (drives the ring highlight in the UI, Instagram-style).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const follows = await prisma.follow.findMany({ where: { followerId: userId } });
  const blockedIds = await blockedUserIds(userId);
  const authorIds = [userId, ...follows.map((f) => f.followingId)].filter((id) => !blockedIds.includes(id));

  // Whose close-friends list am I on? Needed to decide whether a
  // CLOSE_FRIENDS story from author X should be visible to me - only if
  // X has me in their list (or X is me).
  const memberOfLists = await prisma.closeFriend.findMany({
    where: { friendId: userId },
    select: { ownerId: true },
  });
  const closeFriendOfIds = new Set(memberOfLists.map((m) => m.ownerId));

  const stories = await prisma.story.findMany({
    where: { userId: { in: authorIds }, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      views: { where: { viewerId: userId }, select: { id: true } },
    },
  });

  const visibleStories = stories.filter(
    (s) => s.audience === "EVERYONE" || s.userId === userId || closeFriendOfIds.has(s.userId)
  );

  const byUser = new Map<
    string,
    { user: { id: string; name: string; handle: string }; stories: { id: string; imageUrl: string | null; videoUrl: string | null; createdAt: Date; seen: boolean; closeFriendsOnly: boolean }[] }
  >();

  for (const s of visibleStories) {
    const entry = byUser.get(s.userId) ?? { user: s.user, stories: [] };
    entry.stories.push({
      id: s.id,
      imageUrl: s.imageUrl,
      videoUrl: s.videoUrl,
      createdAt: s.createdAt,
      seen: s.views.length > 0,
      closeFriendsOnly: s.audience === "CLOSE_FRIENDS",
    });
    byUser.set(s.userId, entry);
  }

  const groups = Array.from(byUser.values())
    .map((g) => ({ ...g, allSeen: g.stories.every((s) => s.seen) }))
    // self first, then unseen-first among the rest
    .sort((a, b) => {
      if (a.user.id === userId) return -1;
      if (b.user.id === userId) return 1;
      return Number(a.allSeen) - Number(b.allSeen);
    });

  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  {
    const unverified = await requireVerifiedEmail(session.user.id);
    if (unverified) return unverified;
  }

  const limited = await checkRateLimit(`post:${session.user.id}`, "post");
  if (!limited.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { imageUrl, videoUrl, closeFriendsOnly } = await req.json();
  if ((!imageUrl && !videoUrl) || (imageUrl && videoUrl)) {
    return NextResponse.json({ error: "empty_story" }, { status: 400 });
  }
  const url = imageUrl || videoUrl;
  if (typeof url !== "string") {
    return NextResponse.json({ error: "empty_story" }, { status: 400 });
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const expectedPrefix = cloudName ? `https://res.cloudinary.com/${cloudName}/` : null;
  if (expectedPrefix && !url.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const now = new Date();
  const story = await prisma.story.create({
    data: {
      userId: session.user.id,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      audience: closeFriendsOnly ? "CLOSE_FRIENDS" : "EVERYONE",
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({
    id: story.id,
    imageUrl: story.imageUrl,
    videoUrl: story.videoUrl,
    createdAt: story.createdAt,
    closeFriendsOnly: story.audience === "CLOSE_FRIENDS",
  });
}
