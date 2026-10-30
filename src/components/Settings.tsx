"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { UserRound, LogOut, ChevronRight, X, Eye, MessageCircle, Play } from "lucide-react";
import AppShell from "./AppShell";
import ThemeToggle from "./ThemeToggle";
import PostGrid, { PostLightbox, GridPost } from "./PostGrid";
import { GridSkeleton } from "./Skeletons";
import BlockedAccounts from "./BlockedAccounts";

type StoryRow = {
  id: string;
  imageUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  closeFriendsOnly: boolean;
  viewCount: number;
  active: boolean;
};
type CommentRow = { id: string; text: string; createdAt: string; post: GridPost };
type Tab = "stories" | "likes" | "comments";

function when(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export default function Settings() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("stories");

  const [stories, setStories] = useState<StoryRow[] | null>(null);
  const [likes, setLikes] = useState<GridPost[] | null>(null);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [failed, setFailed] = useState<Tab | null>(null);
  const [openStory, setOpenStory] = useState<StoryRow | null>(null);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);

  // Each tab loads the first time you open it.
  const load = useCallback(async (t: Tab) => {
    setFailed(null);
    try {
      const res = await fetch(`/api/activity/${t}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (t === "stories") setStories(d.stories || []);
      if (t === "likes") setLikes(d.posts || []);
      if (t === "comments") setComments(d.items || []);
    } catch {
      setFailed(t);
      if (t === "stories") setStories([]);
      if (t === "likes") setLikes([]);
      if (t === "comments") setComments([]);
    }
  }, []);

  useEffect(() => {
    if (tab === "stories" && stories === null) load("stories");
    if (tab === "likes" && likes === null) load("likes");
    if (tab === "comments" && comments === null) load("comments");
  }, [tab, stories, likes, comments, load]);

  // Unliking inside the viewer drops the post from "Likes".
  const patchLikes = useCallback((id: string, p: Partial<GridPost>) => {
    setLikes((prev) => (prev ? (p.liked === false ? prev.filter((x) => x.id !== id) : prev.map((x) => (x.id === id ? { ...x, ...p } : x))) : prev));
  }, []);
  const patchCommentPost = useCallback((id: string, p: Partial<GridPost>) => {
    setComments((prev) => (prev ? prev.map((c) => (c.post.id === id ? { ...c, post: { ...c.post, ...p } } : c)) : prev));
  }, []);

  const openComment = comments?.find((c) => c.id === openCommentId) || null;
  const handle = session?.user?.handle;

  return (
    <AppShell active="profile">
      <div className="ap-shell ig-page-narrow">
        <div className="feed-greeting">
          <div>
            <p className="eyebrow">Your account</p>
            <h1>Settings.</h1>
          </div>
        </div>

        <div className="ig-settings-card">
          {handle && (
            <Link href={`/u/${handle}?edit=1`} className="ig-settings-row">
              <UserRound size={19} />
              <span>Edit profile</span>
              <ChevronRight size={17} className="ig-settings-chev" />
            </Link>
          )}
          <div className="ig-settings-row ig-settings-theme">
            <ThemeToggle />
          </div>
          <button className="ig-settings-row" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut size={19} />
            <span>Log out</span>
          </button>
        </div>

        <BlockedAccounts />

        <h2 className="ig-settings-h2">Your activity</h2>
        <p className="ig-page-sub">Only you can see this.</p>

        <div className="ig-seg">
          {(["stories", "likes", "comments"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "stories" ? "Stories" : t === "likes" ? "Liked" : "Comments"}
            </button>
          ))}
        </div>

        {failed === tab && <div className="ap-loading">Couldn't load this. Try again in a moment.</div>}

        {tab === "stories" && (
          <>
            {stories === null && <GridSkeleton count={6} />}
            {stories?.length === 0 && failed !== "stories" && <div className="ap-loading">You haven't posted any stories yet.</div>}
            <div className="ig-story-archive">
              {stories?.map((s) => (
                <button key={s.id} className="ig-story-archive-tile" onClick={() => setOpenStory(s)}>
                  {s.imageUrl ? (
                    <Image src={s.imageUrl} alt="" fill sizes="(max-width: 720px) 33vw, 200px" style={{ objectFit: "cover" }} />
                  ) : s.videoUrl ? (
                    <video src={s.videoUrl} preload="metadata" muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                  {s.videoUrl && <span className="ig-profile-grid-carousel-badge"><Play size={10} fill="currentColor" /></span>}
                  <span className="ig-story-archive-meta">
                    <span>{when(s.createdAt)}</span>
                    <span className="ig-story-archive-views"><Eye size={11} /> {s.viewCount}</span>
                  </span>
                  {s.active && <span className="ig-story-archive-live">Live</span>}
                  {s.closeFriendsOnly && <span className="ig-story-archive-cf">Close friends</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "likes" && (
          <>
            {likes === null && <GridSkeleton />}
            {likes?.length === 0 && failed !== "likes" && <div className="ap-loading">Posts and reels you like will show up here.</div>}
            {likes && likes.length > 0 && <PostGrid posts={likes} onPatch={patchLikes} />}
          </>
        )}

        {tab === "comments" && (
          <>
            {comments === null && <div className="ap-loading">Loading…</div>}
            {comments?.length === 0 && failed !== "comments" && <div className="ap-loading">Comments you write on posts and reels will show up here.</div>}
            <div className="ig-activity-list">
              {comments?.map((c) => (
                <button key={c.id} className="ig-activity-row" onClick={() => setOpenCommentId(c.id)}>
                  <span className="ig-activity-thumb">
                    {c.post.imageUrl ? (
                      <Image src={c.post.imageUrl} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
                    ) : c.post.videoUrl ? (
                      <video src={c.post.videoUrl} preload="metadata" muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <MessageCircle size={18} />
                    )}
                  </span>
                  <span className="ig-activity-text">
                    <span className="ig-activity-comment">“{c.text}”</span>
                    <span className="ig-activity-sub">
                      On {c.post.isReel ? "a reel" : "a post"} by {c.post.user.name} · {when(c.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {openStory && (
        <div className="ig-story-viewer" onClick={() => setOpenStory(null)}>
          <div className="ig-story-header" onClick={(e) => e.stopPropagation()}>
            <span className="ig-story-header-name">{when(openStory.createdAt)} · {openStory.viewCount} views</span>
            <button className="ig-story-close" onClick={() => setOpenStory(null)} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="ig-story-image-wrap">
            {openStory.videoUrl ? (
              <video src={openStory.videoUrl} controls autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <Image className="ig-story-image" src={openStory.imageUrl!} alt="story" fill sizes="100vw" />
            )}
          </div>
        </div>
      )}

      {openComment && (
        <PostLightbox
          post={openComment.post}
          onClose={() => setOpenCommentId(null)}
          onPatch={patchCommentPost}
          note={`Your comment: “${openComment.text}”`}
        />
      )}
    </AppShell>
  );
}
