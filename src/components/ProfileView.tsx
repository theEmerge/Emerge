"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Send, Camera, Bookmark, X, LogOut, Pencil, Settings as SettingsIcon } from "lucide-react";
import Avatar from "./Avatar";
import AppShell from "./AppShell";
import LikesModal from "./LikesModal";
import UserListModal from "./UserListModal";
import PostDetailModal from "./PostDetailModal";
import PostGrid, { GridPost } from "./PostGrid";
import { GridSkeleton } from "./Skeletons";
import EditProfileModal from "./EditProfileModal";
import ReportBlockMenu from "./ReportBlockMenu";

type CommunityRef = { id: string; name: string; slug: string } | null;
type TagRef = { id: string; name: string; handle: string };

type Post = {
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

// A saved post from GET /api/saved - deliberately a smaller shape than
// Post above. Saved is a private bookmark shelf, not a feed context, so
// it skips like/reshare state entirely; unsaving is the only action.
type SavedPost = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  images: string[];
  videoUrl: string | null;
  isReel: boolean;
  createdAt: string;
  savedAt: string;
  user: { id: string; name: string; handle: string; avatarUrl: string | null };
  likeCount: number | null;
  commentCount: number;
};

type Profile = {
  user: { id: string; name: string; handle: string; avatarUrl: string | null; bannerUrl: string | null; bio: string | null };
  isSelf: boolean;
  followerCount: number;
  followingCount: number;
  recognizedCount: number;
  isFollowing: boolean;
  posts: Post[];
  nextCursor: string | null;
};

export default function ProfileView({ handle }: { handle: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [likesModalPostId, setLikesModalPostId] = useState<string | null>(null);
  const [listModal, setListModal] = useState<"followers" | "following" | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "reshares">("posts");
  const [reshares, setReshares] = useState<GridPost[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [savedPosts, setSavedPosts] = useState<SavedPost[] | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [openSavedId, setOpenSavedId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<"avatar" | "banner" | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, kind: "avatar" | "banner") {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingPhoto(kind);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/uploads", { method: "POST", body: form });
      if (!uploadRes.ok) return;
      const { url } = await uploadRes.json();
      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "avatar" ? { avatarUrl: url } : { bannerUrl: url }),
      });
      if (patchRes.ok) {
        setProfile((prev) =>
          prev ? { ...prev, user: { ...prev.user, [kind === "avatar" ? "avatarUrl" : "bannerUrl"]: url } } : prev
        );
        if (kind === "avatar") await update({ avatarUrl: url });
      }
    } finally {
      setUploadingPhoto(null);
      if (kind === "avatar" && avatarFileRef.current) avatarFileRef.current.value = "";
      if (kind === "banner" && bannerFileRef.current) bannerFileRef.current.value = "";
    }
  }

  function startEditingBio() {
    setBioDraft(profile?.user.bio || "");
    setEditingBio(true);
  }

  async function saveBio() {
    if (!profile || savingBio) return;
    setSavingBio(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioDraft.trim() }),
      });
      if (res.ok) {
        setProfile({ ...profile, user: { ...profile.user, bio: bioDraft.trim() } });
        setEditingBio(false);
      }
    } finally {
      setSavingBio(false);
    }
  }

  useEffect(() => {
    if (profile?.isSelf && new URLSearchParams(window.location.search).get("edit") === "1") setEditing(true);
  }, [profile?.isSelf]);

  const load = useCallback(async () => {
    setReshares(null);
    setLoading(true);
    const res = await fetch(`/api/users/${handle}`);
    if (res.ok) setProfile(await res.json());
    setLoading(false);
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!profile?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/users/${handle}?cursor=${encodeURIComponent(profile.nextCursor)}`);
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) =>
          prev ? { ...prev, posts: [...prev.posts, ...data.posts], nextCursor: data.nextCursor } : prev
        );
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleFollow() {
    if (!profile) return;
    setProfile({
      ...profile,
      isFollowing: !profile.isFollowing,
      followerCount: profile.followerCount + (profile.isFollowing ? -1 : 1),
    });
    await fetch(`/api/follow/${profile.user.id}`, { method: "POST" });
  }

  async function startConversation() {
    if (!profile || messaging) return;
    setMessaging(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.user.id }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/messages/${id}`);
      }
    } finally {
      setMessaging(false);
    }
  }

  async function loadSaved() {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/saved");
      if (res.ok) {
        const data = await res.json();
        setSavedPosts(data.posts || []);
      }
    } finally {
      setLoadingSaved(false);
    }
  }

  async function loadReshares() {
    try {
      const res = await fetch(`/api/users/${handle}/reshares`);
      setReshares(res.ok ? (await res.json()).posts || [] : []);
    } catch {
      setReshares([]);
    }
  }

  function selectTab(tab: "posts" | "saved" | "reshares") {
    setActiveTab(tab);
    if (tab === "saved" && savedPosts === null) loadSaved();
    if (tab === "reshares" && reshares === null) loadReshares();
  }

  const patchReshare = useCallback((id: string, p: Partial<GridPost>) => {
    setReshares((prev) => (prev ? prev.map((x) => (x.id === id ? { ...x, ...p } : x)) : prev));
  }, []);

  async function unsave(id: string) {
    setSavedPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    setOpenSavedId(null);
    await fetch(`/api/posts/${id}/save`, { method: "DELETE" });
  }

  async function toggleSave(id: string) {
    if (!profile) return;
    setProfile({ ...profile, posts: profile.posts.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)) });
    const current = profile.posts.find((p) => p.id === id);
    const res = await fetch(`/api/posts/${id}/save`, { method: current?.saved ? "DELETE" : "POST" });
    if (res.ok) {
      const data = await res.json();
      setProfile((prev) =>
        prev ? { ...prev, posts: prev.posts.map((p) => (p.id === id ? { ...p, saved: data.saved } : p)) } : prev
      );
    }
  }

  async function toggleLike(id: string) {
    if (!profile) return;
    setProfile({
      ...profile,
      posts: profile.posts.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likeCount: p.likeCount == null ? null : p.likeCount + (p.liked ? -1 : 1) } : p
      ),
    });
    const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
    const data = await res.json();
    setProfile((prev) =>
      prev
        ? { ...prev, posts: prev.posts.map((p) => (p.id === id ? { ...p, liked: data.liked } : p)) }
        : prev
    );
  }

  async function toggleReshare(id: string, isOwnPost: boolean) {
    if (!profile || isOwnPost) return;
    setProfile({
      ...profile,
      posts: profile.posts.map((p) =>
        p.id === id
          ? { ...p, reshared: !p.reshared, reshareCount: p.reshareCount + (p.reshared ? -1 : 1) }
          : p
      ),
    });
    const res = await fetch(`/api/posts/${id}/reshare`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            posts: prev.posts.map((p) =>
              p.id === id ? { ...p, reshared: data.reshared, reshareCount: data.reshareCount } : p
            ),
          }
        : prev
    );
  }

  async function deletePost(id: string) {
    if (!profile || !confirm("Delete this post? This can't be undone.")) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProfile({ ...profile, posts: profile.posts.filter((p) => p.id !== id) });
    }
  }

  async function toggleHelpful(id: string) {
    if (!profile) return;
    const res = await fetch(`/api/posts/${id}/helpful`, { method: "POST" });
    const data = await res.json();
    setProfile({
      ...profile,
      posts: profile.posts.map((p) => (p.id === id ? { ...p, helpfulCount: data.count } : p)),
    });
  }

  return (
    <AppShell active="profile">
      <div className="ap-shell">
        {loading && <div className="ap-loading">Loading profile…</div>}
        {!loading && !profile && <div className="ap-loading">User not found.</div>}

        {profile && (
          <>
            <div className="ap-cover">
              {profile.user.bannerUrl && (
                <Image src={profile.user.bannerUrl} alt="" fill sizes="100vw" style={{ objectFit: "cover", borderRadius: 16 }} />
              )}
              {profile.isSelf && (
                <button
                  className="ig-photo-edit-btn ig-banner-edit-btn"
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={uploadingPhoto === "banner"}
                  title="Change banner"
                >
                  <Camera size={15} />
                  {uploadingPhoto === "banner" ? "Uploading…" : "Edit banner"}
                </button>
              )}
              <input
                ref={bannerFileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handlePhotoUpload(e, "banner")}
              />
            </div>
            <div className="ap-profile-block">
              <div className="ig-profile-avatar-wrap">
                <Avatar name={profile.user.name} src={profile.user.avatarUrl} size={64} />
                {profile.isSelf && (
                  <button
                    className="ig-photo-edit-btn ig-avatar-edit-btn"
                    onClick={() => avatarFileRef.current?.click()}
                    disabled={uploadingPhoto === "avatar"}
                    title="Change profile photo"
                  >
                    <Camera size={13} />
                  </button>
                )}
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handlePhotoUpload(e, "avatar")}
                />
              </div>
              <div className="ap-profile-name">{profile.user.name}</div>
              <div className="ap-profile-handle">@{profile.user.handle}</div>

              {editingBio ? (
                <div className="ig-bio-edit">
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    maxLength={160}
                    placeholder="Write a short bio..."
                    rows={2}
                    autoFocus
                  />
                  <div className="ig-bio-edit-actions">
                    <span className="ig-bio-counter">{bioDraft.length}/160</span>
                    <button className="ig-bio-cancel" onClick={() => setEditingBio(false)}>Cancel</button>
                    <button className="ap-post-btn" onClick={saveBio} disabled={savingBio}>
                      {savingBio ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ig-bio-row">
                  {profile.user.bio && <p className="ig-bio-text">{profile.user.bio}</p>}
                  {profile.isSelf && (
                    <button className="ig-bio-edit-link" onClick={startEditingBio}>
                      {profile.user.bio ? "Edit bio" : "+ Add bio"}
                    </button>
                  )}
                </div>
              )}

              {profile.isSelf && (
                <div className="ig-self-actions">
                  <button className="ig-self-btn primary" onClick={() => setEditing(true)}>
                    <Pencil size={15} /> Edit profile
                  </button>
                  <Link href="/settings" className="ig-self-btn">
                    <SettingsIcon size={15} /> Settings
                  </Link>
                  <button className="ig-self-btn ig-logout-mobile" onClick={() => signOut({ callbackUrl: "/login" })}>
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              )}

              {!profile.isSelf && (
                <div className="ig-profile-actions">
                  <button className="ap-post-btn" onClick={toggleFollow}>
                    {profile.isFollowing ? "Following" : "Follow"}
                  </button>
                  <button className="ig-message-btn" onClick={startConversation} disabled={messaging}>
                    <Send size={14} /> Message
                  </button>
                  <ReportBlockMenu
                    target={{ type: "USER", id: profile.user.id }}
                    userId={profile.user.id}
                    handle={profile.user.handle}
                    onBlocked={() => { window.location.href = "/"; }}
                  />
                </div>
              )}

              <div className="hub-profile-links">
                <span className="hx-muted">Also on Emerge:</span>
                <Link href={`/connection/in/${profile.user.handle}`}>Professional profile</Link>
                <Link href={`/developer/u/${profile.user.handle}`}>Developer profile</Link>
              </div>

              <div className="ap-stat-grid">
                <button className="ap-stat ap-stat-btn" onClick={() => setListModal("followers")}>
                  <b>{profile.followerCount}</b><span>Followers</span>
                </button>
                <button className="ap-stat ap-stat-btn" onClick={() => setListModal("following")}>
                  <b>{profile.followingCount}</b><span>Following</span>
                </button>
                <div className="ap-stat"><b>{profile.recognizedCount}</b><span>Recognized</span></div>
              </div>

              <div className="ap-tabs">
                <span className={activeTab === "posts" ? "on" : ""} onClick={() => selectTab("posts")}>Posts</span>
                <span className={activeTab === "reshares" ? "on" : ""} onClick={() => selectTab("reshares")}>Reshares</span>
                {profile.isSelf && (
                  <span className={activeTab === "saved" ? "on" : ""} onClick={() => selectTab("saved")}>Saved</span>
                )}
              </div>

              {activeTab === "reshares" ? (
                <>
                  {reshares === null && <GridSkeleton count={6} />}
                  {reshares?.length === 0 && (
                    <div className="ap-loading">{profile.isSelf ? "Posts and reels you reshare will show up here." : "No reshares yet."}</div>
                  )}
                  {reshares && reshares.length > 0 && <PostGrid posts={reshares} onPatch={patchReshare} />}
                </>
              ) : activeTab === "posts" ? (
                <>
                  {profile.posts.length === 0 && (
                    <div className="ap-loading">No posts yet.</div>
                  )}

                  <div className="ig-profile-grid">
                    {profile.posts.map((post) => (
                      <button key={post.id} className="ig-profile-grid-cell" onClick={() => setOpenPostId(post.id)}>
                        {post.imageUrl ? (
                          <Image src={post.imageUrl} alt="" fill sizes="200px" style={{ objectFit: "cover" }} />
                        ) : (
                          <span className="ig-profile-grid-text">{post.text}</span>
                        )}
                        {post.images.length > 1 && <span className="ig-profile-grid-carousel-badge">▣</span>}
                        {post.likeCount != null && post.likeCount > 0 && (
                          <span className="ig-profile-grid-overlay">
                            <Heart size={14} fill="currentColor" /> {post.likeCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {profile.nextCursor && (
                    <button className="ap-load-more" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {loadingSaved && <div className="ap-loading">Loading saved posts…</div>}
                  {!loadingSaved && savedPosts?.length === 0 && (
                    <div className="ap-loading">Nothing saved yet.</div>
                  )}
                  <div className="ig-profile-grid">
                    {savedPosts?.map((post) => (
                      <button key={post.id} className="ig-profile-grid-cell" onClick={() => setOpenSavedId(post.id)}>
                        {post.imageUrl ? (
                          <Image src={post.imageUrl} alt="" fill sizes="200px" style={{ objectFit: "cover" }} />
                        ) : (
                          <span className="ig-profile-grid-text">{post.text}</span>
                        )}
                        {post.images.length > 1 && <span className="ig-profile-grid-carousel-badge">▣</span>}
                        {post.isReel && <span className="ig-profile-grid-carousel-badge">▶</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {likesModalPostId && (
        <LikesModal postId={likesModalPostId} onClose={() => setLikesModalPostId(null)} />
      )}
      {listModal && profile && (
        <UserListModal
          title={listModal === "followers" ? "Followers" : "Following"}
          fetchUrl={`/api/users/${profile.user.handle}/${listModal}`}
          emptyText={listModal === "followers" ? "No followers yet." : "Not following anyone yet."}
          onClose={() => setListModal(null)}
        />
      )}
      {openPostId && profile && (() => {
        const openPost = profile.posts.find((p) => p.id === openPostId);
        if (!openPost) return null;
        const isOwnPost = openPost.user.id === profile.user.id && profile.isSelf;
        return (
          <PostDetailModal
            post={openPost}
            isOwnPost={isOwnPost}
            onClose={() => setOpenPostId(null)}
            onLike={toggleLike}
            onReshare={(id) => toggleReshare(id, isOwnPost)}
            onHelpful={toggleHelpful}
            onDelete={deletePost}
            onSave={toggleSave}
          />
        );
      })()}
      {editing && profile && (
        <EditProfileModal
          user={{
            name: profile.user.name,
            handle: profile.user.handle,
            bio: profile.user.bio,
            avatarUrl: profile.user.avatarUrl,
            bannerUrl: profile.user.bannerUrl,
          }}
          onClose={() => setEditing(false)}
          onSaved={async (changes) => {
            setEditing(false);
            await update({
              ...(changes.name !== undefined ? { name: changes.name } : {}),
              ...(changes.handle !== undefined ? { handle: changes.handle } : {}),
              ...(changes.avatarUrl !== undefined ? { avatarUrl: changes.avatarUrl } : {}),
            });
            if (changes.handle && changes.handle !== profile.user.handle) {
              router.replace(`/u/${changes.handle}`);
            } else {
              setProfile({ ...profile, user: { ...profile.user, ...changes } });
            }
          }}
        />
      )}
      {openSavedId && savedPosts && (() => {
        const saved = savedPosts.find((p) => p.id === openSavedId);
        if (!saved) return null;
        return (
          <div className="ig-postdetail-overlay" onClick={() => setOpenSavedId(null)}>
            <div className="ig-postdetail-panel" onClick={(e) => e.stopPropagation()}>
              <button className="ig-postdetail-close" onClick={() => setOpenSavedId(null)} aria-label="Close">
                <X size={20} />
              </button>
              {saved.imageUrl && (
                <div className="ig-postdetail-image">
                  <Image src={saved.imageUrl} alt="post" fill sizes="(max-width: 700px) 100vw, 500px" style={{ objectFit: "contain" }} />
                </div>
              )}
              <div className="ig-postdetail-body">
                <div className="ig-post-head">
                  <Link href={`/u/${saved.user.handle}`}>
                    <Avatar name={saved.user.name} src={saved.user.avatarUrl} size={32} />
                  </Link>
                  <div className="ig-post-user">
                    <Link href={`/u/${saved.user.handle}`} className="ig-name-link">
                      <span className="ig-post-name">{saved.user.name}</span>
                    </Link>
                  </div>
                  <button className="ig-post-delete" onClick={() => unsave(saved.id)} title="Unsave">
                    <Bookmark size={18} fill="currentColor" />
                  </button>
                </div>
                {saved.text && <p className="ig-post-caption">{saved.text}</p>}
                <div className="ap-karma-note">{saved.likeCount != null ? `${saved.likeCount} likes · ` : ""}{saved.commentCount} comments</div>
                <Link href={`/u/${saved.user.handle}`} className="ap-post-btn" style={{ display: "inline-block", textAlign: "center", marginTop: 10 }}>
                  View profile
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}
