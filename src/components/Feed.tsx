"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Repeat2, Image as ImageIcon, X, UserPlus, Search, MapPin } from "lucide-react";
import PostCard, { FeedPost as Post } from "./PostCard";
import { FeedSkeleton } from "./Skeletons";
import Avatar from "./Avatar";
import AppShell from "./AppShell";
import StoriesBar from "./StoriesBar";
import LikesModal from "./LikesModal";
import TagPicker, { TagUser } from "./TagPicker";

type Person = { id: string; name: string; handle: string; avatarUrl: string | null };
type Community = { id: string; slug: string; name: string; description: string | null; memberCount: number; joined: boolean };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export default function Feed() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [locationText, setLocationText] = useState("");
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [activeChip, setActiveChip] = useState<string>("following"); // "following" or a community id
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Welcome back");
  const firstName = (session?.user?.name || "").split(" ")[0];
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night");
  }, []);

  const [draftText, setDraftText] = useState("");
  const [draftImages, setDraftImages] = useState<string[]>([]); // local previews (object URLs)
  const [draftFiles, setDraftFiles] = useState<File[]>([]); // actual files, uploaded on submit
  const [previewIndex, setPreviewIndex] = useState(0);
  const [target, setTarget] = useState<string>("feed"); // "feed" or a community id
  const [posting, setPosting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<TagUser[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [likesModalPostId, setLikesModalPostId] = useState<string | null>(null);

  // Photo tagging: tap a spot on the preview image to drop a pin, then
  // pick who it is from a tiny inline search right at that point -
  // Instagram's "tag people" flow, rather than a plain unpositioned list.
  const [taggingOnPhoto, setTaggingOnPhoto] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinQuery, setPinQuery] = useState("");
  const [pinResults, setPinResults] = useState<TagUser[]>([]);
  const [positionedTags, setPositionedTags] = useState<
    { userId: string; name: string; avatarUrl: string | null; x: number; y: number; imageIndex: number }[]
  >([]);


  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFeed = useCallback(async () => {
    // Posts render as soon as they arrive; the communities sidebar fills in
    // on its own instead of holding the whole feed back.
    fetch("/api/communities")
      .then((r) => r.json())
      .then((d) => setCommunities(d.communities || []))
      .catch(() => {});
    fetch("/api/users/suggestions")
      .then((r) => r.json())
      .then((d) => setPeople(d.users || []))
      .catch(() => {});
    try {
      const feedRes = await fetch("/api/feed");
      const feedData = await feedRes.json();
      setPosts(feedData.posts || []);
      setFeedCursor(feedData.nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadMorePosts() {
    if (!feedCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(feedCursor)}`);
      const data = await res.json();
      setPosts((prev) => [...prev, ...(data.posts || [])]);
      setFeedCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (searchParams.get("compose") === "1") {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchParams]);

  const joinedCommunities = communities.filter((c) => c.joined);

  const visiblePosts =
    activeChip === "following"
      ? posts
      : posts.filter((p) => p.community?.id === activeChip);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadError(null);
    const room = Math.max(0, 10 - draftFiles.length);
    const accepted = files.slice(0, room);
    setDraftFiles((prev) => [...prev, ...accepted]);
    setDraftImages((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeDraftImage(index: number) {
    setDraftImages((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setDraftFiles((prev) => prev.filter((_, i) => i !== index));
    setPositionedTags((prev) =>
      prev
        .filter((t) => t.imageIndex !== index)
        .map((t) => (t.imageIndex > index ? { ...t, imageIndex: t.imageIndex - 1 } : t))
    );
    setPreviewIndex((i) => Math.max(0, Math.min(i, draftImages.length - 2)));
  }

  function clearDraftImage() {
    draftImages.forEach((url) => URL.revokeObjectURL(url));
    setDraftImages([]);
    setDraftFiles([]);
    setPositionedTags([]);
    setPreviewIndex(0);
    setTaggingOnPhoto(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!taggingOnPhoto) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingPin({ x, y });
    setPinQuery("");
    setPinResults([]);
  }

  useEffect(() => {
    if (pinQuery.trim().length < 1) {
      setPinResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(pinQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setPinResults(data.users || []);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [pinQuery]);

  function placePin(u: TagUser) {
    if (!pendingPin) return;
    setPositionedTags((prev) => [
      ...prev.filter((t) => t.userId !== u.id),
      { userId: u.id, name: u.name, avatarUrl: u.avatarUrl, x: pendingPin.x, y: pendingPin.y, imageIndex: previewIndex },
    ]);
    setPendingPin(null);
  }

  async function submitPost() {
    if (!draftText.trim() && draftFiles.length === 0) return;
    setPosting(true);
    setUploadError(null);
    try {
      const communityId = target !== "feed" ? target : null;

      const images: string[] = [];
      for (const file of draftFiles) {
        const form = new FormData();
        form.append("file", file);
        const uploadRes = await fetch("/api/uploads", { method: "POST", body: form });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          setUploadError(
            body.error === "email_not_verified"
              ? "Confirm your email first - check your inbox for the link."
              : body.error === "rate_limited"
              ? "Too many uploads - try again in a minute."
              : body.error === "file_too_large"
              ? "That image is too large."
              : "Upload failed - try again."
          );
          return;
        }
        const { url } = await uploadRes.json();
        images.push(url);
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: draftText,
          images,
          communityId,
          taggedUserIds: taggedUsers.map((u) => u.id),
          positionedTags: positionedTags.map((t) => ({ userId: t.userId, x: t.x, y: t.y, imageIndex: t.imageIndex })),
          location: locationText,
        }),
      });
      if (res.status === 429) {
        setUploadError("You're posting too fast - try again in a minute.");
        return;
      }
      if (res.status === 403) {
        setUploadError("Confirm your email first - check your inbox for the link.");
        return;
      }
      if (!res.ok) {
        setUploadError("Couldn't post - try again.");
        return;
      }
      const post: Post = await res.json();
      setPosts((prev) => [{ ...post, type: "post" }, ...prev]);
      setDraftText("");
      setTaggedUsers([]);
      setLocationText("");
      clearDraftImage();
    } finally {
      setPosting(false);
    }
  }

  const meId = session?.user?.id;
  const postsRef = useRef<Post[]>([]);
  postsRef.current = posts;

  const toggleLike = useCallback(async (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likeCount: p.likeCount == null ? null : p.likeCount + (p.liked ? -1 : 1) } : p))
    );
    const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
    const data = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, liked: data.liked } : p)));
  }, []);

  const toggleSave = useCallback(async (id: string) => {
    const wasSaved = !!postsRef.current.find((p) => p.id === id)?.saved;
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)));
    const res = await fetch(`/api/posts/${id}/save`, { method: wasSaved ? "DELETE" : "POST" });
    if (res.ok) {
      const data = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, saved: data.saved } : p)));
    }
  }, []);

  const toggleReshare = useCallback(
    async (id: string) => {
      const current = postsRef.current.find((p) => p.id === id);
      if (current?.user.id === meId) return; // can't reshare your own post
      const flip = (p: Post) => ({ ...p, reshared: !p.reshared, reshareCount: p.reshareCount + (p.reshared ? -1 : 1) });
      setPosts((prev) => prev.map((p) => (p.id === id ? flip(p) : p)));
      const res = await fetch(`/api/posts/${id}/reshare`, { method: "POST" });
      if (!res.ok) {
        // roll back optimistic update on failure (e.g. own-post 400)
        setPosts((prev) => prev.map((p) => (p.id === id ? flip(p) : p)));
        return;
      }
      const data = await res.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, reshared: data.reshared, reshareCount: data.reshareCount } : p))
      );
    },
    [meId]
  );

  const deletePost = useCallback(async (id: string) => {
    if (!confirm("Delete this post? This can't be undone.")) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleHelpful = useCallback(async (id: string) => {
    const res = await fetch(`/api/posts/${id}/helpful`, { method: "POST" });
    const data = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, helpfulCount: data.count } : p)));
  }, []);

  const bumpCommentCount = useCallback((id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, commentCount: p.commentCount + 1 } : p)));
  }, []);

  const toggleFollowPerson = useCallback(async (id: string) => {
    setFollowed((f) => ({ ...f, [id]: !f[id] }));
    const res = await fetch(`/api/follow/${id}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setFollowed((f) => ({ ...f, [id]: data.following }));
    } else {
      setFollowed((f) => ({ ...f, [id]: !f[id] }));
    }
  }, []);

  const hideBlockedUser = useCallback(
    (uid: string) => setPosts((prev) => prev.filter((p) => p.user.id !== uid && p.resharedBy?.id !== uid)),
    []
  );
  const showLikes = useCallback((id: string) => setLikesModalPostId(id), []);

  async function toggleJoin(id: string) {
    setCommunities((prev) => prev.map((c) => (c.id === id ? { ...c, joined: !c.joined } : c)));
    const res = await fetch(`/api/communities/${id}/join`, { method: "POST" });
    const data = await res.json();
    setCommunities((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, joined: data.joined, memberCount: c.memberCount + (data.joined ? 1 : -1) }
          : c
      )
    );
    if (!data.joined && activeChip === id) setActiveChip("following");
    if (!data.joined && target === id) setTarget("feed");
  }

  let lastDay: string | null = null;
  const topCommunity = communities.length ? [...communities].sort((x, y) => y.memberCount - x.memberCount)[0] : null;

  return (
    <AppShell active="home">
      <div className="ap-shell">
        <div className="ap-body">
          <main className="ap-feed">
            <div className="feed-greeting">
              <div>
                <p className="eyebrow">Your daily mix</p>
                <h1>{greeting}{firstName ? `, ${firstName}` : ""}.</h1>
              </div>
              <Link href="/search" className="ig-round-btn" aria-label="Search">
                <Search size={19} />
              </Link>
            </div>

            <StoriesBar />

            <div className="ap-chip-row">
              <button
                className={"ap-chip" + (activeChip === "following" ? " active" : "")}
                onClick={() => setActiveChip("following")}
              >
                Following
              </button>
              {joinedCommunities.map((c) => (
                <button
                  key={c.id}
                  className={"ap-chip" + (activeChip === c.id ? " active" : "")}
                  onClick={() => setActiveChip(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="ap-composer">
              {joinedCommunities.length > 0 && (
                <div className="ap-target-row">
                  <span className="ap-target-label">Share to</span>
                  <select
                    className="ap-target-select"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="feed">Your feed</option>
                    {joinedCommunities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="ap-composer-top">
                <Avatar name={session?.user?.name || "You"} src={session?.user?.avatarUrl} size={38} />
                <textarea
                  ref={textareaRef}
                  placeholder="What's happening?"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={draftText.length > 60 ? 3 : 1}
                />
              </div>
              {draftImages.length > 0 && (
                <div className="ap-composer-preview">
                  <div className="ap-composer-preview-main" onClick={onPreviewClick}>
                    <img src={draftImages[previewIndex]} alt="upload preview" />
                    {positionedTags
                      .filter((t) => t.imageIndex === previewIndex)
                      .map((t) => (
                        <button
                          key={t.userId}
                          className="ig-tag-pin"
                          style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPositionedTags((prev) => prev.filter((p) => p.userId !== t.userId));
                          }}
                        >
                          {t.name} <X size={10} />
                        </button>
                      ))}
                    {pendingPin && (
                      <div
                        className="ig-tag-pin-picker"
                        style={{ left: `${pendingPin.x * 100}%`, top: `${pendingPin.y * 100}%` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          placeholder="Tag someone…"
                          value={pinQuery}
                          onChange={(e) => setPinQuery(e.target.value)}
                        />
                        {pinResults.map((u) => (
                          <button key={u.id} onClick={() => placePin(u)}>
                            <Avatar name={u.name} src={u.avatarUrl} size={22} /> {u.name}
                          </button>
                        ))}
                        <button className="ig-tag-pin-cancel" onClick={() => setPendingPin(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                    <button className="ap-composer-remove-img" onClick={(e) => { e.stopPropagation(); removeDraftImage(previewIndex); }}>
                      <X size={14} />
                    </button>
                  </div>
                  {draftImages.length > 1 && (
                    <div className="ap-composer-thumbs">
                      {draftImages.map((src, i) => (
                        <button
                          key={i}
                          className={"ap-composer-thumb" + (i === previewIndex ? " active" : "")}
                          onClick={() => setPreviewIndex(i)}
                        >
                          <img src={src} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="ap-composer-preview-hint">
                    {taggingOnPhoto ? "Tap the photo to tag someone" : `${draftImages.length}/10 photos`}
                  </div>
                </div>
              )}
              {taggedUsers.length > 0 && (
                <div className="ig-selected-chips" style={{ padding: "0 0 6px" }}>
                  {taggedUsers.map((u) => (
                    <button key={u.id} className="ig-selected-chip" onClick={() => setTaggedUsers((prev) => prev.filter((x) => x.id !== u.id))}>
                      {u.name} <X size={12} />
                    </button>
                  ))}
                </div>
              )}
              <div className="ap-composer-location">
                <MapPin size={15} />
                <input
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Add a place"
                  maxLength={80}
                  disabled={posting}
                />
              </div>
              {uploadError && <div className="ap-composer-error">{uploadError}</div>}
              <div className="ap-composer-bar">
                <button className="ap-icon-btn" onClick={() => fileRef.current?.click()} disabled={posting}>
                  <ImageIcon size={16} /> Photo
                </button>
                {draftImages.length > 0 && (
                  <button
                    className={"ap-icon-btn" + (taggingOnPhoto ? " active" : "")}
                    onClick={() => { setTaggingOnPhoto((v) => !v); setPendingPin(null); }}
                    disabled={posting}
                  >
                    <UserPlus size={16} /> Tag on photo
                  </button>
                )}
                <button className="ap-icon-btn" onClick={() => setShowTagPicker(true)} disabled={posting}>
                  <UserPlus size={16} /> Tag
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} style={{ display: "none" }} />
                <button
                  className="ap-post-btn"
                  disabled={posting || (!draftText.trim() && draftImages.length === 0)}
                  onClick={submitPost}
                >
                  {posting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>

            {loading && <FeedSkeleton />}
            {!loading && visiblePosts.length === 0 && (
              <div className="ap-loading">Nothing here yet.</div>
            )}

            {visiblePosts.map((post, index) => {
              const label = dayLabel(post.createdAt);
              const showDivider = label !== lastDay;
              lastDay = label;
              const key = post.type === "reshare" ? `reshare-${post.reshareId}` : post.id;
              return (
                <div key={key}>
                  {showDivider && (
                    <div className="ap-date-divider">
                      <span>{label}</span>
                    </div>
                  )}
                  {post.type === "reshare" && post.resharedBy && (
                    <div className="ap-reshare-header">
                      <Repeat2 size={13} />
                      <span>
                        {post.resharedBy.id === meId ? (
                          "You"
                        ) : (
                          <Link href={`/u/${post.resharedBy.handle}`} className="ig-name-link">
                            {post.resharedBy.name}
                          </Link>
                        )}{" "}
                        reshared
                      </span>
                    </div>
                  )}
                  <PostCard
                    post={post}
                    meId={meId}
                    priority={index === 0}
                    onLike={toggleLike}
                    onSave={toggleSave}
                    onReshare={toggleReshare}
                    onDelete={deletePost}
                    onHelpful={toggleHelpful}
                    onShowLikes={showLikes}
                    onCommentAdded={bumpCommentCount}
                    onBlocked={hideBlockedUser}
                  />
                </div>
              );
            })}

            {!loading && feedCursor && activeChip === "following" && (
              <button className="ap-load-more" onClick={loadMorePosts} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </main>

          <aside className="ap-rail">
            {people.length > 0 && (
              <section className="ap-people">
                <p className="eyebrow">People</p>
                <h2 className="ap-rail-heading">Worth following</h2>
                <div className="ap-people-list">
                  {people.map((u) => (
                    <div className="ap-person" key={u.id}>
                      <Link href={`/u/${u.handle}`}>
                        <Avatar name={u.name} src={u.avatarUrl} size={36} />
                      </Link>
                      <Link href={`/u/${u.handle}`} className="ap-person-text">
                        <span className="ap-person-name">{u.name}</span>
                        <span className="ap-person-handle">@{u.handle}</span>
                      </Link>
                      <button
                        className={"ap-follow-pill" + (followed[u.id] ? " following" : "")}
                        onClick={() => toggleFollowPerson(u.id)}
                      >
                        {followed[u.id] ? "Following" : "Follow"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {topCommunity && (
              <div className="ap-trend-card">
                <p className="eyebrow">Trending now</p>
                <p className="ap-trend-title">{topCommunity.name}</p>
                <p className="ap-trend-sub">
                  {topCommunity.memberCount.toLocaleString()} {topCommunity.memberCount === 1 ? "person is" : "people are"} sharing here.
                </p>
                <button className="ap-trend-link" onClick={() => toggleJoin(topCommunity.id)}>
                  {topCommunity.joined ? "Joined ✓" : "Join the community →"}
                </button>
              </div>
            )}

            {communities.length > 1 && (
              <div className="ap-rail-card">
                <div className="ap-rail-title">Communities</div>
                {communities.slice(0, 5).map((c) => (
                  <div className="ap-sugg-row" key={c.id}>
                    <div>
                      <div className="ap-sugg-name">{c.name}</div>
                      <div className="ap-sugg-sub">{c.memberCount} members</div>
                    </div>
                    <button className={"ap-join-btn" + (c.joined ? " joined" : "")} onClick={() => toggleJoin(c.id)}>
                      {c.joined ? "Joined" : "Join"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <footer className="ap-rail-footer">About · Help · Privacy · Terms<br />© 2026 Emerge</footer>
          </aside>
        </div>
      </div>
      {likesModalPostId && (
        <LikesModal postId={likesModalPostId} onClose={() => setLikesModalPostId(null)} />
      )}
      {showTagPicker && (
        <TagPicker selected={taggedUsers} onChange={setTaggedUsers} onClose={() => setShowTagPicker(false)} />
      )}
    </AppShell>
  );
}
