// Shared shape for the square-grid views (Saved, Discover, Reshares and the
// Settings > Your activity tabs). Posts and reels use the same row.
export function gridInclude(viewerId: string) {
  return {
    user: { select: { id: true, name: true, handle: true, avatarUrl: true } },
    images: { orderBy: { position: "asc" as const } },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { id: true } },
    savedBy: { where: { userId: viewerId }, select: { id: true } },
  };
}

type GridSource = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  isReel: boolean;
  createdAt: Date;
  location: string | null;
  user: { id: string; name: string; handle: string; avatarUrl: string | null };
  images: { url: string }[];
  _count: { likes: number; comments: number };
  likes: { id: string }[];
  savedBy: { id: string }[];
};

export function shapeGridPost(p: GridSource, viewerId: string) {
  return {
    id: p.id,
    text: p.text,
    imageUrl: p.imageUrl,
    images: p.images.length > 0 ? p.images.map((i) => i.url) : p.imageUrl ? [p.imageUrl] : [],
    videoUrl: p.videoUrl,
    isReel: p.isReel,
    createdAt: p.createdAt,
    location: p.location,
    user: p.user,
    // Like counts are hidden: only the author sees them.
    likeCount: p.user.id === viewerId ? p._count.likes : null,
    commentCount: p._count.comments,
    liked: p.likes.length > 0,
    saved: p.savedBy.length > 0,
  };
}
