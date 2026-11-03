import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOwnMediaUrl } from "@/lib/mediaUrl";
import { claimNextFrame } from "@/lib/rolls";
import { checkRateLimit } from "@/lib/rateLimit";
import { notify } from "@/lib/notifications";
import { requireVerifiedEmail } from "@/lib/verified";

const validCloudinaryUrl = isOwnMediaUrl;

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

  // The client uploads media first via POST /api/uploads (which re-encodes
  // images / passes through video, and stores it in S3-compatible storage)
  // and sends us the resulting URL. This route never touches raw bytes.
  const { text, imageUrl, images, communityId, isReel, videoUrl, taggedUserIds, positionedTags, location } = await req.json().catch(() => ({}));
  if (text !== undefined && text !== null && (typeof text !== "string" || text.length > 5000)) {
    return NextResponse.json({ error: "invalid_text" }, { status: 400 });
  }
  if (communityId !== undefined && communityId !== null && typeof communityId !== "string") {
    return NextResponse.json({ error: "invalid_community" }, { status: 400 });
  }

  // Optional place: a typed place name only. Exact GPS coordinates are never
  // accepted or stored.
  const cleanLocation = typeof location === "string" ? location.trim().slice(0, 80) || null : null;

  // `images` (a carousel) takes priority over the legacy single `imageUrl`
  // - the first slide becomes the post's cover imageUrl (for back-compat
  // with every reader that only knows about imageUrl: notifications,
  // profile grid thumbnails, share previews, old API consumers). Every
  // slide, including the cover, also gets its own PostImage row so
  // carousel-aware UI (Feed, PostDetailModal) can render the full set.
  const carousel: string[] = Array.isArray(images)
    ? images.filter((u: unknown): u is string => typeof u === "string" && !!u).slice(0, 10)
    : [];
  const coverImageUrl: string | null = carousel[0] || (typeof imageUrl === "string" && imageUrl ? imageUrl : null);

  if (isReel) {
    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ error: "empty_post" }, { status: 400 });
    }
    if (!validCloudinaryUrl(videoUrl)) {
      return NextResponse.json({ error: "invalid_video_url" }, { status: 400 });
    }
  } else if (!text?.trim() && !coverImageUrl) {
    return NextResponse.json({ error: "empty_post" }, { status: 400 });
  }
  if (coverImageUrl && !validCloudinaryUrl(coverImageUrl)) {
    // Reject URLs that didn't come from our own upload endpoint - a post
    // should never be able to point at an arbitrary external image.
    return NextResponse.json({ error: "invalid_image_url" }, { status: 400 });
  }
  for (const url of carousel) {
    if (!validCloudinaryUrl(url)) {
      return NextResponse.json({ error: "invalid_image_url" }, { status: 400 });
    }
  }

  let rollId: string | null = null;
  let frameNumber: number | null = null;

  // Posting to a community, or posting a reel, never touches your personal
  // roll - reels are their own vertical-video container, not a contact
  // sheet frame. No cap enforcement here anymore - claimNextFrame just
  // increments a running counter for the archive view now, it never
  // rejects a post.
  if (coverImageUrl && !communityId && !isReel) {
    const claimed = await claimNextFrame(session.user.id);
    rollId = claimed.rollId;
    frameNumber = claimed.frameNumber;
  }

  if (communityId) {
    const membership = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: session.user.id, communityId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "not_a_member" }, { status: 403 });
    }
  }

  const post = await prisma.post.create({
    data: {
      userId: session.user.id,
      text: text?.trim() || null,
      imageUrl: coverImageUrl,
      rollId,
      frameNumber,
      communityId: communityId || null,
      isReel: !!isReel,
      videoUrl: isReel ? videoUrl : null,
      location: isReel ? null : cleanLocation,
      ...(carousel.length > 0
        ? { images: { createMany: { data: carousel.map((url, i) => ({ url, position: i })) } } }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
      community: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { position: "asc" } },
    },
  });

  // Tag people: merge the plain "with @a" list (taggedUserIds) with any
  // positional pins (positionedTags) into one map keyed by userId, so a
  // person who got both a pin AND was in the plain list only ends up
  // tagged once - dedupe, drop the author (tagging yourself is a no-op),
  // and only tag real users. Each tagged person gets one TAG notification.
  type TagInput = { userId: string; x?: number; y?: number; imageIndex?: number };
  const tagMap = new Map<string, TagInput>();
  if (Array.isArray(positionedTags)) {
    for (const t of positionedTags) {
      if (
        t && typeof t.userId === "string" && t.userId !== session.user.id &&
        typeof t.x === "number" && typeof t.y === "number" &&
        t.x >= 0 && t.x <= 1 && t.y >= 0 && t.y <= 1
      ) {
        tagMap.set(t.userId, { userId: t.userId, x: t.x, y: t.y, imageIndex: typeof t.imageIndex === "number" ? t.imageIndex : 0 });
      }
    }
  }
  if (Array.isArray(taggedUserIds)) {
    for (const id of taggedUserIds) {
      if (typeof id === "string" && id !== session.user.id && !tagMap.has(id)) {
        tagMap.set(id, { userId: id });
      }
    }
  }
  const tagInputs = Array.from(tagMap.values()).slice(0, 20);

  let tags: { id: string; name: string; handle: string; avatarUrl: string | null }[] = [];
  if (tagInputs.length > 0) {
    const taggedUsers = await prisma.user.findMany({
      where: { id: { in: tagInputs.map((t) => t.userId) } },
      select: { id: true, name: true, handle: true, avatarUrl: true },
    });
    const validIds = new Set(taggedUsers.map((u) => u.id));
    await prisma.postTag.createMany({
      data: tagInputs
        .filter((t) => validIds.has(t.userId))
        .map((t) => ({ postId: post.id, userId: t.userId, x: t.x ?? null, y: t.y ?? null, imageIndex: t.imageIndex ?? 0 })),
      skipDuplicates: true,
    });
    await Promise.all(
      taggedUsers.map((u) => notify({ recipientId: u.id, actorId: session.user.id, type: "TAG", postId: post.id }))
    );
    tags = taggedUsers;
  }

  return NextResponse.json({
    id: post.id,
    text: post.text,
    imageUrl: post.imageUrl,
    images: post.images.map((img) => img.url),
    videoUrl: post.videoUrl,
    isReel: post.isReel,
    frameNumber: post.frameNumber,
    location: post.location,
    createdAt: post.createdAt,
    user: post.user,
    community: post.community,
    tags,
    commentCount: 0,
    helpfulCount: 0,
    liked: false,
    likeCount: 0,
    reshareCount: 0,
    reshared: false,
    resharedBy: null,
    saved: false,
  });
}
