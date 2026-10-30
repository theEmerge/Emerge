"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Heart, MessageCircle, Repeat2, Send, Volume2, VolumeX, X, ChevronUp, ChevronDown, Play } from "lucide-react";
import Avatar from "./Avatar";
import AppShell from "./AppShell";
import Link from "next/link";
import LikesModal from "./LikesModal";
import ShareSheet from "./ShareSheet";
import { cldVideoUrl } from "@/lib/cloudinaryUrl";
import { uploadVideoDirect } from "@/lib/cloudinaryDirectUpload";
import TagPicker, { TagUser } from "./TagPicker";

type Reel = {
  id: string;
  text: string | null;
  videoUrl: string;
  createdAt: string;
  user: { id: string; name: string; handle: string; avatarUrl: string | null };
  tags: TagUser[];
  commentCount: number;
  liked: boolean;
  likeCount: number | null;
  reshared: boolean;
  reshareCount: number;
};

type Comment = { id: string; text: string; user: { name: string; handle: string } };

// Vertical, one-video-per-screen feed, Instagram-Reels-style. Reels are
// just Post rows with isReel=true (see /api/reels and /api/posts), so
// likes/comments/reshares reuse the exact same endpoints the main feed
// uses - only the presentation here is different.
export default function Reels() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<TagUser[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [likesModalPostId, setLikesModalPostId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; videoUrl: string } | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/reels");
    if (res.ok) {
      const data = await res.json();
      setReels(data.reels || []);
      setCursor(data.nextCursor ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reached via the global "+" chooser (AppShell -> NewPostChooser), which
  // navigates here with ?create=1 instead of this page having its own
  // "New reel" button.
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      fileRef.current?.click();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollByOne(direction: 1 | -1) {
    const root = containerRef.current;
    if (!root) return;
    root.scrollBy({ top: direction * root.clientHeight, behavior: "smooth" });
  }

  function toggleTapPlayPause(id: string) {
    const video = videoRefs.current[id];
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  // Best-effort deep link: only works if the target reel happens to be in
  // the pages already loaded (no separate "fetch this one reel" endpoint) -
  // good enough for a link shared moments ago, which is the common case.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const el = containerRef.current?.querySelector(`[data-reel-id="${openId}"]`);
    el?.scrollIntoView({ block: "start" });
  }, [reels, searchParams]);

  function openShareSheet(id: string, videoUrl: string) {
    setShareTarget({ id, videoUrl });
  }

  async function loadMore() {
    if (!cursor) return;
    const res = await fetch(`/api/reels?cursor=${encodeURIComponent(cursor)}`);
    if (res.ok) {
      const data = await res.json();
      setReels((prev) => [...prev, ...(data.reels || [])]);
      setCursor(data.nextCursor ?? null);
    }
  }

  // Play whichever reel is scrolled into view, pause the rest - a simple
  // intersection observer stands in for a proper virtualized player. It
  // also triggers loading the next page once the last reel comes into view.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const lastId = reels.length > 0 ? reels[reels.length - 1].id : null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-reel-id");
          const video = id ? videoRefs.current[id] : null;
          if (video) {
            if (entry.isIntersecting) video.play().catch(() => {});
            else video.pause();
          }
          if (entry.isIntersecting && id && id === lastId) loadMore();
        }
      },
      { root, threshold: 0.6 }
    );
    root.querySelectorAll("[data-reel-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels]);

  async function toggleLike(id: string) {
    setReels((prev) =>
      prev.map((r) => (r.id === id ? { ...r, liked: !r.liked, likeCount: r.likeCount == null ? null : r.likeCount + (r.liked ? -1 : 1) } : r))
    );
    const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
    const data = await res.json();
    setReels((prev) => prev.map((r) => (r.id === id ? { ...r, liked: data.liked } : r)));
  }

  async function toggleReshare(id: string) {
    const r = reels.find((x) => x.id === id);
    if (r?.user.id === session?.user?.id) return;
    setReels((prev) =>
      prev.map((x) => (x.id === id ? { ...x, reshared: !x.reshared, reshareCount: x.reshareCount + (x.reshared ? -1 : 1) } : x))
    );
    const res = await fetch(`/api/posts/${id}/reshare`, { method: "POST" });
    if (!res.ok) {
      // roll the optimistic toggle back so the button never sticks in a wrong state
      setReels((prev) =>
        prev.map((x) => (x.id === id ? { ...x, reshared: !x.reshared, reshareCount: x.reshareCount + (x.reshared ? -1 : 1) } : x))
      );
      return;
    }
    const data = await res.json();
    setReels((prev) => prev.map((x) => (x.id === id ? { ...x, reshared: data.reshared, reshareCount: data.reshareCount } : x)));
  }

  async function openCommentsFor(id: string) {
    setOpenComments(id);
    if (!comments[id]) {
      const res = await fetch(`/api/posts/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => ({ ...prev, [id]: data.comments }));
      }
    }
  }

  async function addComment() {
    if (!openComments || !commentDraft.trim()) return;
    const id = openComments;
    const res = await fetch(`/api/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentDraft.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => ({ ...prev, [id]: [...(prev[id] || []), data.comment] }));
      setReels((prev) => prev.map((r) => (r.id === id ? { ...r, commentCount: r.commentCount + 1 } : r)));
      setCommentDraft("");
    }
  }

  async function postReel() {
    if (!pendingFile) return;
    const file = pendingFile;
    setShowTagPicker(false);
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      let url: string;
      try {
        url = await uploadVideoDirect(file, setUploadProgress);
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        setUploadError(
          code === "CLOUDINARY_NOT_CONFIGURED"
            ? "Video upload isn't configured yet."
            : code === "VIDEO_TOO_LARGE"
            ? "Video is too large (max 100 MB)."
            : code === "VIDEO_BAD_FORMAT"
            ? "Please choose a video file."
            : code === "EMAIL_NOT_VERIFIED"
            ? "Confirm your email first - check your inbox for the link."
            : code === "RATE_LIMITED"
            ? "Too many uploads - try again in a minute."
            : "Upload failed - try again."
        );
        return;
      }
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReel: true, videoUrl: url, taggedUserIds: taggedUsers.map((u) => u.id) }),
      });
      if (res.ok) {
        const reel = await res.json();
        setReels((prev) => [
          { ...reel, commentCount: 0, liked: false, likeCount: 0, reshared: false, reshareCount: 0 },
          ...prev,
        ]);
        setTaggedUsers([]);
      } else if (res.status === 403) {
        setUploadError("Confirm your email first - check your inbox for the link.");
      }
    } finally {
      setUploading(false);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowTagPicker(true);
  }

  return (
    <AppShell active="reels">
      <div className="ig-reels-shell">
        <input ref={fileRef} type="file" accept="video/*" onChange={onFileSelected} style={{ display: "none" }} />
        {uploading && <div className="ig-reels-upload-error" style={{ color: "var(--text-dim)" }}>Uploading… {uploadProgress}%</div>}
        {uploadError && <div className="ig-reels-upload-error">{uploadError}</div>}

        {loading && <div className="ap-loading">Loading reels…</div>}
        {!loading && reels.length === 0 && (
          <div className="ap-loading">No reels yet - tap + to post one.</div>
        )}

        <button className="ig-reels-arrow up" onClick={() => scrollByOne(-1)} aria-label="Previous reel">
          <ChevronUp size={18} />
        </button>
        <div className="ig-reels-scroller" ref={containerRef}>
          {reels.map((reel) => (
            <div className="ig-reel" key={reel.id} data-reel-id={reel.id}>
              <video
                ref={(el) => {
                  videoRefs.current[reel.id] = el;
                }}
                src={cldVideoUrl(reel.videoUrl)}
                loop
                muted={muted}
                playsInline
                onClick={() => toggleTapPlayPause(reel.id)}
                onPlay={() => setPausedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(reel.id);
                  return next;
                })}
                onPause={() => setPausedIds((prev) => new Set(prev).add(reel.id))}
              />
              {pausedIds.has(reel.id) && (
                <div className="ig-reel-pause-overlay">
                  <Play size={48} fill="#fff" />
                </div>
              )}
              <button className="ig-reel-mute" onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <div className="ig-reel-meta">
                <div className="ig-reel-user">
                  <Link href={`/u/${reel.user.handle}`} className="ig-name-link" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={reel.user.name} src={reel.user.avatarUrl} size={30} />
                    <span>{reel.user.name}</span>
                  </Link>
                </div>
                {reel.tags.length > 0 && (
                  <div className="ig-reel-tags">
                    with{" "}
                    {reel.tags.map((t, i) => (
                      <span key={t.id}>
                        <Link href={`/u/${t.handle}`} className="ig-name-link">
                          {t.name}
                        </Link>
                        {i < reel.tags.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                )}
                {reel.text && <p className="ig-reel-caption">{reel.text}</p>}
              </div>

              <div className="ig-reel-actions">
                <button className={"ig-icon-action" + (reel.liked ? " liked" : "")} onClick={() => toggleLike(reel.id)}>
                  <Heart size={26} fill={reel.liked ? "currentColor" : "none"} />
                </button>
                {reel.likeCount != null && reel.likeCount > 0 && (
                  <button className="ig-reel-count-btn" onClick={() => setLikesModalPostId(reel.id)}>
                    {reel.likeCount}
                  </button>
                )}
                <button className="ig-icon-action" onClick={() => openCommentsFor(reel.id)}>
                  <MessageCircle size={26} />
                  <span>{reel.commentCount > 0 ? reel.commentCount : ""}</span>
                </button>
                <button
                  className={"ig-icon-action" + (reel.reshared ? " reshared" : "")}
                  onClick={() => toggleReshare(reel.id)}
                  disabled={reel.user.id === session?.user?.id}
                >
                  <Repeat2 size={26} strokeWidth={reel.reshared ? 2.6 : 2} />
                  <span>{reel.reshareCount > 0 ? reel.reshareCount : ""}</span>
                </button>
                <button className="ig-icon-action" onClick={() => openShareSheet(reel.id, reel.videoUrl)}>
                  <Send size={24} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="ig-reels-arrow down" onClick={() => scrollByOne(1)} aria-label="Next reel">
          <ChevronDown size={18} />
        </button>

        {openComments && (
          <div className="ig-reel-comments-overlay" onClick={() => setOpenComments(null)}>
            <div className="ig-reel-comments-panel" onClick={(e) => e.stopPropagation()}>
              <div className="ig-reel-comments-head">
                <span>Comments</span>
                <button onClick={() => setOpenComments(null)}><X size={18} /></button>
              </div>
              <div className="ig-reel-comments-list">
                {(comments[openComments] || []).map((c) => (
                  <div className="ap-comment" key={c.id}>
                    <Link href={`/u/${c.user.handle}`} className="ig-name-link"><b>{c.user.name}</b></Link>
                    <span>{c.text}</span>
                  </div>
                ))}
                {(comments[openComments] || []).length === 0 && (
                  <div className="ap-sugg-sub">No comments yet.</div>
                )}
              </div>
              <div className="ap-comment-row">
                <input
                  placeholder="Add a comment..."
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                />
                <button onClick={addComment}>
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {likesModalPostId && (
        <LikesModal postId={likesModalPostId} onClose={() => setLikesModalPostId(null)} />
      )}
      {showTagPicker && (
        <TagPicker selected={taggedUsers} onChange={setTaggedUsers} onClose={postReel} doneLabel="Post reel" />
      )}
      {shareTarget && (
        <ShareSheet reelId={shareTarget.id} videoUrl={shareTarget.videoUrl} onClose={() => setShareTarget(null)} />
      )}
    </AppShell>
  );
}
