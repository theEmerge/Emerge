"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, Bookmark, X, ChevronLeft, ChevronRight, Play, MapPin } from "lucide-react";
import Avatar from "./Avatar";

export type GridPost = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  images: string[];
  videoUrl: string | null;
  isReel: boolean;
  createdAt: string;
  location?: string | null;
  user: { id: string; name: string; handle: string; avatarUrl: string | null };
  likeCount: number | null;
  commentCount: number;
  liked: boolean;
  saved: boolean;
};

// Square-tile grid + a focused lightbox. Shared by Discover and Saved.
// The parent owns the list; like/save are optimistic and reported back
// through onPatch so each page decides what that means (Saved drops a
// post the moment you un-save it).
export default function PostGrid({
  posts,
  onPatch,
}: {
  posts: GridPost[];
  onPatch: (id: string, patch: Partial<GridPost>) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = posts.find((p) => p.id === openId) || null;

  return (
    <>
      <div className="ig-profile-grid ig-explore-grid">
        {posts.map((p) => (
          <button key={p.id} className="ig-profile-grid-cell" onClick={() => setOpenId(p.id)} aria-label={`Open post by ${p.user.name}`}>
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt="" fill sizes="(max-width: 720px) 33vw, 200px" style={{ objectFit: "cover" }} />
            ) : p.videoUrl ? (
              <video src={p.videoUrl} preload="metadata" muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span className="ig-profile-grid-text">{p.text}</span>
            )}
            {p.images.length > 1 && <span className="ig-profile-grid-carousel-badge">▣</span>}
            {p.isReel && (
              <span className="ig-profile-grid-carousel-badge">
                <Play size={10} fill="currentColor" />
              </span>
            )}
            {p.likeCount != null && p.likeCount > 0 && (
              <span className="ig-profile-grid-overlay">
                <Heart size={13} fill="currentColor" /> {p.likeCount}
              </span>
            )}
          </button>
        ))}
      </div>
      {open && <PostLightbox post={open} onClose={() => setOpenId(null)} onPatch={onPatch} />}
    </>
  );
}

// The focused viewer for one post or reel. `note` lets a caller show extra
// context under the caption (e.g. "Your comment: ...").
export function PostLightbox({
  post: open,
  onClose,
  onPatch,
  note,
}: {
  post: GridPost;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<GridPost>) => void;
  note?: string;
}) {
  const [slide, setSlide] = useState(0);

  async function like(p: GridPost) {
    onPatch(p.id, { liked: !p.liked, likeCount: p.likeCount == null ? null : p.likeCount + (p.liked ? -1 : 1) });
    const res = await fetch(`/api/posts/${p.id}/like`, { method: "POST" });
    if (!res.ok) onPatch(p.id, { liked: p.liked, likeCount: p.likeCount });
  }

  async function save(p: GridPost) {
    onPatch(p.id, { saved: !p.saved });
    const res = await fetch(`/api/posts/${p.id}/save`, { method: p.saved ? "DELETE" : "POST" });
    if (!res.ok) onPatch(p.id, { saved: p.saved });
  }

  return (
    <div className="ig-postdetail-overlay" onClick={onClose}>
      <div className="ig-postdetail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="ig-postdetail-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        {(open.images.length > 0 || open.videoUrl) && (
          <div className="ig-postdetail-image">
            {open.videoUrl ? (
              <video src={open.videoUrl} controls autoPlay loop playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <Image src={open.images[slide] || open.images[0]} alt="" fill sizes="(max-width: 720px) 100vw, 640px" style={{ objectFit: "contain" }} />
            )}
            {open.images.length > 1 && (
              <>
                <div className="ig-carousel-count">{slide + 1}/{open.images.length}</div>
                {slide > 0 && (
                  <button className="ig-carousel-arrow left" onClick={() => setSlide((s) => s - 1)} aria-label="Previous photo">
                    <ChevronLeft size={18} />
                  </button>
                )}
                {slide < open.images.length - 1 && (
                  <button className="ig-carousel-arrow right" onClick={() => setSlide((s) => s + 1)} aria-label="Next photo">
                    <ChevronRight size={18} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
        <div className="ig-postdetail-body">
          <div className="ig-post-head">
            <Link href={`/u/${open.user.handle}`}>
              <Avatar name={open.user.name} src={open.user.avatarUrl} size={34} />
            </Link>
            <div className="ig-post-user ig-post-user-col">
              <Link href={`/u/${open.user.handle}`} className="ig-name-link">
                <span className="ig-post-name">{open.user.name}</span>
              </Link>
              {open.location && (
                <span className="ig-post-sub">
                  <MapPin size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
                  {open.location}
                </span>
              )}
            </div>
          </div>
          <div className="ig-post-actions">
            <button className={"ig-icon-action" + (open.liked ? " liked" : "")} onClick={() => like(open)} aria-label="Like">
              <Heart size={22} fill={open.liked ? "currentColor" : "none"} />
            </button>
            <span className="ig-postdetail-count">
              <MessageCircle size={20} /> {open.commentCount}
            </span>
            <button className="ig-icon-action" style={{ marginLeft: "auto" }} onClick={() => save(open)} aria-label={open.saved ? "Remove from saved" : "Save"}>
              <Bookmark size={20} fill={open.saved ? "currentColor" : "none"} />
            </button>
          </div>
          {open.likeCount != null && open.likeCount > 0 && <div className="ig-post-likes">{open.likeCount.toLocaleString()} likes</div>}
          {open.text && (
            <p className="ig-post-caption">
              <span className="ig-post-caption-name">{open.user.name}</span> {open.text}
            </p>
          )}
          {note && <p className="ig-activity-note">{note}</p>}
          <Link href={`/u/${open.user.handle}`} className="ap-reveal-link" style={{ marginTop: 10 }}>
            View profile
          </Link>
        </div>
      </div>
    </div>
  );
}
