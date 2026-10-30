"use client";
import { useSession } from "next-auth/react";
import ReportBlockMenu from "./ReportBlockMenu";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MessageCircle, Repeat2, ThumbsUp, Trash2, X, Send, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import Avatar from "./Avatar";

type TagRef = { id: string; name: string; handle: string; x?: number | null; y?: number | null; imageIndex?: number };
type CommunityRef = { id: string; name: string; slug: string } | null;
type Comment = { id: string; text: string; userId?: string; user: { name: string; handle: string } };

type DetailPost = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  images: string[];
  createdAt: string;
  user: { id: string; name: string; handle: string; avatarUrl: string | null };
  community: CommunityRef;
  tags: TagRef[];
  commentCount: number;
  helpfulCount: number | null;
  liked: boolean;
  likeCount: number | null;
  reshared: boolean;
  reshareCount: number;
  saved: boolean;
};

// The lightbox a grid-tile click opens on the profile page - same
// interactions as a feed post card (like/comment/reshare/delete, tags),
// just presented as a single focused overlay instead of a scrolling card.
export default function PostDetailModal({
  post,
  isOwnPost,
  onClose,
  onLike,
  onReshare,
  onHelpful,
  onDelete,
  onSave,
}: {
  post: DetailPost;
  isOwnPost: boolean;
  onClose: () => void;
  onLike: (id: string) => void;
  onReshare: (id: string) => void;
  onHelpful: (id: string) => void;
  onDelete: (id: string) => void;
  onSave?: (id: string) => void;
}) {
  const { data: session } = useSession();
  const meId = session?.user?.id;
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [slide, setSlide] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const isCommunityPost = !!post.community;
  const images = post.images.length > 0 ? post.images : post.imageUrl ? [post.imageUrl] : [];
  const pinsOnSlide = post.tags.filter((t) => (t.imageIndex ?? 0) === slide && t.x != null && t.y != null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/${post.id}/comments`).then(async (res) => {
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setComments(data.comments || []);
    });
    return () => {
      cancelled = true;
    };
  }, [post.id]);

  async function addComment() {
    if (!draft.trim()) return;
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => [...(prev || []), data.comment]);
      setDraft("");
    }
  }

  return (
    <div className="ig-postdetail-overlay" onClick={onClose}>
      <div className="ig-postdetail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="ig-postdetail-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {images.length > 0 && (
          <div className="ig-postdetail-image" onClick={() => pinsOnSlide.length > 0 && setShowTags((v) => !v)}>
            <Image src={images[slide]} alt="post" fill sizes="(max-width: 700px) 100vw, 500px" style={{ objectFit: "contain" }} />
            {showTags &&
              pinsOnSlide.map((t) => (
                <Link
                  key={t.id}
                  href={`/u/${t.handle}`}
                  className="ig-tag-pin"
                  style={{ left: `${(t.x ?? 0.5) * 100}%`, top: `${(t.y ?? 0.5) * 100}%` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.name}
                </Link>
              ))}
            {images.length > 1 && (
              <>
                <div className="ig-carousel-count">{slide + 1}/{images.length}</div>
                {slide > 0 && (
                  <button className="ig-carousel-arrow left" onClick={(e) => { e.stopPropagation(); setSlide((s) => s - 1); }}>
                    <ChevronLeft size={18} />
                  </button>
                )}
                {slide < images.length - 1 && (
                  <button className="ig-carousel-arrow right" onClick={(e) => { e.stopPropagation(); setSlide((s) => s + 1); }}>
                    <ChevronRight size={18} />
                  </button>
                )}
                <div className="ig-carousel-dots">
                  {images.map((_, i) => (
                    <span key={i} className={i === slide ? "active" : ""} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="ig-postdetail-body">
          <div className="ig-post-head">
            <Link href={`/u/${post.user.handle}`}>
              <Avatar name={post.user.name} src={post.user.avatarUrl} size={32} />
            </Link>
            <div className="ig-post-user">
              <Link href={`/u/${post.user.handle}`} className="ig-name-link">
                <span className="ig-post-name">{post.user.name}</span>
              </Link>
              {isCommunityPost && <span className="ig-post-dot">·</span>}
              {isCommunityPost && <span className="ig-post-community">{post.community!.name}</span>}
            </div>
            {isOwnPost ? (
              <button className="ig-post-delete" onClick={() => onDelete(post.id)} title="Delete post" aria-label="Delete post">
                <Trash2 size={15} />
              </button>
            ) : (
              <ReportBlockMenu target={{ type: "POST", id: post.id }} userId={post.user.id} handle={post.user.handle} />
            )}
          </div>

          {post.tags.length > 0 && (
            <div className="ig-post-tags">
              with{" "}
              {post.tags.map((t, i) => (
                <span key={t.id}>
                  <Link href={`/u/${t.handle}`} className="ig-name-link">{t.name}</Link>
                  {i < post.tags.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}

          {isCommunityPost ? (
            <div className="ap-post-actions">
              <button className="ap-helpful-btn" onClick={() => onHelpful(post.id)}>
                <ThumbsUp size={12} style={{ marginRight: 5, verticalAlign: -1 }} />
                {post.helpfulCount ?? 0} helpful
              </button>
            </div>
          ) : (
            <div className="ig-post-actions">
              <button className={"ig-icon-action" + (post.liked ? " liked" : "")} onClick={() => onLike(post.id)}>
                <Heart size={22} fill={post.liked ? "currentColor" : "none"} />
              </button>
              <button className="ig-icon-action">
                <MessageCircle size={22} />
              </button>
              <button
                className={"ig-icon-action" + (post.reshared ? " reshared" : "")}
                onClick={() => onReshare(post.id)}
                disabled={isOwnPost}
                title={isOwnPost ? "You can't reshare your own post" : "Reshare"}
              >
                <Repeat2 size={22} />
              </button>
              {onSave && (
                <button className="ig-icon-action" style={{ marginLeft: "auto" }} onClick={() => onSave(post.id)}>
                  <Bookmark size={20} fill={post.saved ? "currentColor" : "none"} />
                </button>
              )}
            </div>
          )}

          {!isCommunityPost && post.likeCount != null && post.likeCount > 0 && (
            <div className="ig-post-likes">{post.likeCount.toLocaleString()} likes</div>
          )}
          {post.text && (
            <p className="ig-post-caption">
              <Link href={`/u/${post.user.handle}`} className="ig-name-link">
                <span className="ig-post-caption-name">{post.user.name}</span>
              </Link>{" "}
              {post.text}
            </p>
          )}

          <div className="ap-comments ig-postdetail-comments">
            {comments === null && <div className="ap-loading">Loading comments…</div>}
            {comments?.map((c) => (
              <div className="ap-comment" key={c.id}>
                <Link href={`/u/${c.user.handle}`} className="ig-name-link"><b>{c.user.name}</b></Link>
                <span>{c.text}</span>
                {c.userId && c.userId !== meId && (
                  <ReportBlockMenu target={{ type: "COMMENT", id: c.id }} userId={c.userId} handle={c.user.handle} size={14} />
                )}
              </div>
            ))}
            {comments?.length === 0 && <div className="ap-sugg-sub">No comments yet.</div>}
          </div>
          <div className="ap-comment-row">
            <input
              placeholder="Add a comment..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
            />
            <button onClick={addComment}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
