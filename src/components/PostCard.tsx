"use client";
import { memo, useState, CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import ReportBlockMenu from "./ReportBlockMenu";
import { Heart, MessageCircle, Repeat2, Send, Bookmark, ThumbsUp, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import Avatar from "./Avatar";

export type CommunityRef = { id: string; name: string; slug: string } | null;
export type UserRef = { id: string; name: string; handle: string; avatarUrl: string | null };
export type PostTagRef = UserRef & { x: number | null; y: number | null; imageIndex: number };

export type FeedPost = {
  type: "post" | "reshare";
  id: string;
  text: string | null;
  imageUrl: string | null;
  images: string[];
  createdAt: string;
  user: UserRef;
  community: CommunityRef;
  tags: PostTagRef[];
  commentCount: number;
  helpfulCount: number | null;
  liked: boolean;
  likeCount: number | null;
  reshared: boolean;
  reshareCount: number;
  saved: boolean;
  location?: string | null;
  reshareId?: string;
  resharedBy?: UserRef;
  comment?: string | null;
};

type PostComment = { id: string; text: string; userId?: string; user: { name: string; handle: string } };

// Instagram shows each photo at its native ratio, only clamping the
// extremes: nothing wider than 1.91:1 (landscape) or taller than 4:5
// (portrait) - everything in between (square, 3:2, etc.) renders as-is.
function clampPostRatio(width: number, height: number) {
  const ratio = width / height;
  return Math.min(Math.max(ratio, 4 / 5), 1.91);
}

// "just now", "18 min", "2 hr", "3 d", then a short date.
function agoLabel(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

type Props = {
  post: FeedPost;
  meId?: string;
  priority?: boolean;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onReshare: (id: string) => void;
  onDelete: (id: string) => void;
  onHelpful: (id: string) => void;
  onShowLikes: (id: string) => void;
  onCommentAdded: (id: string) => void;
  onBlocked?: (userId: string) => void;
};

// One post. Carousel position, image ratio and the comment thread/draft are
// local state, so typing a comment or loading an image re-renders only this
// card instead of the whole feed. memo() + stable handlers from Feed keep
// the other cards from re-rendering when one post changes.
function PostCard({ post, meId, priority, onLike, onSave, onReshare, onDelete, onHelpful, onShowLikes, onCommentAdded, onBlocked }: Props) {
  const [slide, setSlide] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [draft, setDraft] = useState("");

  const isCommunityPost = !!post.community;
  const isOwnPost = post.user.id === meId;

  async function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments === null) {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    }
  }

  async function addComment() {
    const text = draft.trim();
    if (!text) return;
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!data.comment) return;
    setComments((prev) => [...(prev || []), data.comment]);
    setDraft("");
    onCommentAdded(post.id);
  }

  return (
    <article className="ig-post-card">
      <div className="ig-post-head">
        <Link href={`/u/${post.user.handle}`}>
          <Avatar name={post.user.name} src={post.user.avatarUrl} size={34} />
        </Link>
        <div className="ig-post-user ig-post-user-col">
          <div className="ig-post-user-line">
            <Link href={`/u/${post.user.handle}`} className="ig-name-link">
              <span className="ig-post-name">{post.user.name}</span>
            </Link>
            {isCommunityPost && <span className="ig-post-dot">·</span>}
            {isCommunityPost && <span className="ig-post-community">{post.community!.name}</span>}
          </div>
          <span className="ig-post-sub">
            {post.location ? `${post.location} · ` : ""}
            {agoLabel(post.createdAt)}
          </span>
        </div>
        {isOwnPost ? (
          <button className="ig-post-delete" onClick={() => onDelete(post.id)} title="Delete post" aria-label="Delete post">
            <Trash2 size={15} />
          </button>
        ) : (
          <ReportBlockMenu target={{ type: "POST", id: post.id }} userId={post.user.id} handle={post.user.handle} onBlocked={onBlocked} />
        )}
      </div>

      {post.tags.length > 0 && (
        <div className="ig-post-tags">
          with{" "}
          {post.tags.map((t, i) => (
            <span key={t.id}>
              <Link href={`/u/${t.handle}`} className="ig-name-link">
                {t.name}
              </Link>
              {i < post.tags.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}

      {post.type === "reshare" && post.comment && <p className="ap-post-text ap-reshare-comment">{post.comment}</p>}

      {post.images.length > 0 && (
        <div className="ig-post-image" style={ratio ? ({ "--post-ratio": ratio } as CSSProperties) : undefined}>
          <Image
            src={post.images[slide] || post.images[0]}
            alt="post"
            width={1200}
            height={900}
            sizes="(max-width: 700px) 100vw, 700px"
            priority={priority}
            onLoad={(e) => {
              const img = e.currentTarget;
              const r = clampPostRatio(img.naturalWidth, img.naturalHeight);
              setRatio((prev) => (prev === r ? prev : r));
            }}
          />
          {post.images.length > 1 && (
            <>
              <div className="ig-carousel-count">
                {slide + 1}/{post.images.length}
              </div>
              {slide > 0 && (
                <button className="ig-carousel-arrow left" onClick={() => setSlide((i) => i - 1)} aria-label="Previous photo">
                  <ChevronLeft size={18} />
                </button>
              )}
              {slide < post.images.length - 1 && (
                <button className="ig-carousel-arrow right" onClick={() => setSlide((i) => i + 1)} aria-label="Next photo">
                  <ChevronRight size={18} />
                </button>
              )}
              <div className="ig-carousel-dots">
                {post.images.map((_, i) => (
                  <span key={i} className={i === slide ? "active" : ""} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {isCommunityPost ? (
        <div className="ap-post-actions">
          <button className="ap-helpful-btn" onClick={() => onHelpful(post.id)}>
            <ThumbsUp size={12} style={{ marginRight: 5, verticalAlign: -1 }} />
            {post.helpfulCount ?? 0} helpful
          </button>
          <button className="ap-action-btn" onClick={toggleComments}>
            <MessageCircle size={18} />
            {post.commentCount > 0 && <span>{post.commentCount}</span>}
          </button>
        </div>
      ) : (
        <div className="ig-post-actions">
          <button className={"ig-icon-action" + (post.liked ? " liked" : "")} onClick={() => onLike(post.id)} aria-label="Like">
            <Heart size={22} fill={post.liked ? "currentColor" : "none"} />
          </button>
          <button className="ig-icon-action" onClick={toggleComments} aria-label="Comments">
            <MessageCircle size={22} />
          </button>
          <button
            className={"ig-icon-action" + (post.reshared ? " reshared" : "")}
            onClick={() => onReshare(post.id)}
            disabled={isOwnPost}
            title={isOwnPost ? "You can't reshare your own post" : "Reshare"}
            aria-label="Reshare"
          >
            <Repeat2 size={22} />
          </button>
          <button className="ig-icon-action" style={{ marginLeft: "auto" }} onClick={() => onSave(post.id)} aria-label="Save">
            <Bookmark size={20} fill={post.saved ? "currentColor" : "none"} />
          </button>
        </div>
      )}

      {!isCommunityPost && post.likeCount != null && post.likeCount > 0 && (
        <button className="ig-post-likes ig-post-likes-btn" onClick={() => onShowLikes(post.id)}>
          {post.likeCount.toLocaleString()} likes
        </button>
      )}

      {post.text && (
        <p className="ig-post-caption">
          <Link href={`/u/${post.user.handle}`} className="ig-name-link">
            <span className="ig-post-caption-name">{post.user.name}</span>
          </Link>{" "}
          {post.text}
        </p>
      )}

      {!isCommunityPost && post.commentCount > 0 && !commentsOpen && (
        <button className="ap-reveal-link" onClick={toggleComments}>
          View all {post.commentCount} comments
        </button>
      )}

      {commentsOpen && (
        <div className="ap-comments">
          {(comments || []).map((c) => (
            <div className="ap-comment" key={c.id}>
              <Link href={`/u/${c.user.handle}`} className="ig-name-link">
                <b>{c.user.name}</b>
              </Link>
              <span>{c.text}</span>
              {c.userId && c.userId !== meId && (
                <ReportBlockMenu target={{ type: "COMMENT", id: c.id }} userId={c.userId} handle={c.user.handle} onBlocked={onBlocked} size={14} />
              )}
            </div>
          ))}
          <div className="ap-comment-row">
            <input
              placeholder="Add a comment..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
            />
            <button onClick={addComment} aria-label="Send comment">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default memo(PostCard);
