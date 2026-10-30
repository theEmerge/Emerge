"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, Plus, Send, Eye, Users } from "lucide-react";
import Image from "next/image";
import Avatar from "./Avatar";
import UserListModal from "./UserListModal";
import CloseFriendsModal from "./CloseFriendsModal";

type StoryItem = { id: string; imageUrl: string | null; videoUrl: string | null; createdAt: string; seen: boolean; closeFriendsOnly: boolean };
type StoryGroup = {
  user: { id: string; name: string; handle: string; avatarUrl: string | null };
  stories: StoryItem[];
  allSeen: boolean;
};

const STORY_MS = 5000;

// Horizontal ring of story avatars above the feed, Instagram-style, plus
// the fullscreen viewer it opens into. "Your story" doubles as the upload
// entry point - tapping it when you have none opens the file picker,
// tapping it when you have some opens your own reel of stories first.
export default function StoriesBar() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null);
  const [viewerStoryIdx, setViewerStoryIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [showSeenBy, setShowSeenBy] = useState(false);
  const [showCloseFriends, setShowCloseFriends] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/stories");
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups || []);
    }
    setLoading(false);
  }, []);

  // Reached via the global "+" chooser (AppShell -> NewPostChooser), which
  // navigates here with ?create=story instead of this needing its own
  // separately-triggered entry point.
  useEffect(() => {
    if (searchParams.get("create") === "story") {
      fileRef.current?.click();
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myGroup = groups.find((g) => g.user.id === session?.user?.id);

  function openGroup(idx: number) {
    setViewerGroupIdx(idx);
    const g = groups[idx];
    const firstUnseen = g.stories.findIndex((s) => !s.seen);
    setViewerStoryIdx(firstUnseen >= 0 ? firstUnseen : 0);
    setReplyText("");
    setReplySent(false);
  }

  async function sendReply(recipientId: string) {
    if (!replyText.trim() || sendingReply) return;
    setSendingReply(true);
    if (timerRef.current) clearTimeout(timerRef.current); // pause auto-advance while replying
    try {
      const convRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: recipientId }),
      });
      if (!convRes.ok) return;
      const { id: conversationId } = await convRes.json();
      const msgRes = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (msgRes.ok) {
        setReplyText("");
        setReplySent(true);
        setTimeout(() => setReplySent(false), 2000);
      }
    } finally {
      setSendingReply(false);
    }
  }

  const closeViewer = useCallback(() => {
    setViewerGroupIdx(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const advance = useCallback(() => {
    setViewerGroupIdx((gi) => {
      if (gi === null) return gi;
      setViewerStoryIdx((si) => {
        const g = groups[gi];
        if (si + 1 < g.stories.length) return si + 1;
        // move to next group, or close if this was the last one
        setTimeout(() => {
          if (gi + 1 < groups.length) openGroup(gi + 1);
          else closeViewer();
        }, 0);
        return si;
      });
      return gi;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, closeViewer]);

  useEffect(() => {
    if (viewerGroupIdx === null) return;
    const g = groups[viewerGroupIdx];
    const s = g?.stories[viewerStoryIdx];
    if (!s) return;
    fetch(`/api/stories/${s.id}/view`, { method: "POST" }).catch(() => {});
    if (timerRef.current) clearTimeout(timerRef.current);
    // Video stories advance on their own when playback ends (see the
    // <video onEnded> handler below) rather than a fixed timer, since a
    // reposted reel can run well past the usual 5s image duration.
    if (!s.videoUrl && !showSeenBy) {
      timerRef.current = setTimeout(advance, STORY_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [viewerGroupIdx, viewerStoryIdx, groups, advance, showSeenBy]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Stage the file and ask "who can see this" before uploading, instead
    // of posting immediately - matches Instagram's share sheet, and is
    // the only place closeFriendsOnly gets decided.
    setPendingFile(file);
  }

  async function uploadStory(closeFriendsOnly: boolean) {
    const file = pendingFile;
    if (!file) return;
    setPendingFile(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/uploads", { method: "POST", body: form });
      if (!uploadRes.ok) return;
      const { url } = await uploadRes.json();
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, closeFriendsOnly }),
      });
      if (res.ok) await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) return null;

  const activeGroup = viewerGroupIdx !== null ? groups[viewerGroupIdx] : null;
  const activeStory = activeGroup ? activeGroup.stories[viewerStoryIdx] : null;

  return (
    <>
      <div className="ig-stories-bar">
        <div className="ig-story-ring-wrap">
          <div className="ig-story-avatar-wrap">
            <button
              className={
                "ig-story-ring" +
                (!myGroup ? " no-story" : "") +
                (myGroup && !myGroup.allSeen ? " unseen" : "") +
                (myGroup?.stories.some((s) => s.closeFriendsOnly) ? " close-friends" : "")
              }
              onClick={() => (myGroup ? openGroup(groups.indexOf(myGroup)) : fileRef.current?.click())}
              aria-label={myGroup ? "View your story" : "Add to your story"}
            >
              <Avatar name={session?.user?.name || "You"} src={session?.user?.avatarUrl} size={54} />
            </button>
            <button
              className="ig-story-add-mini"
              onClick={() => fileRef.current?.click()}
              title="Add to your story"
              aria-label="Add to your story"
              disabled={uploading}
            >
              {uploading ? <span className="ig-story-spinner" /> : <Plus size={13} strokeWidth={3} />}
            </button>
          </div>
          <span className="ig-story-name">Your story</span>
        </div>

        <div className="ig-story-ring-wrap">
          <button className="ig-story-ring close-friends unseen" onClick={() => setShowCloseFriends(true)} aria-label="Close Friends">
            <span className="ig-story-cf-icon">
              <Users size={22} />
            </span>
          </button>
          <span className="ig-story-name">Close friends</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

        {pendingFile && (
          <div className="ig-story-audience-overlay" onClick={() => !uploading && setPendingFile(null)}>
            <div className="ig-story-audience-panel" onClick={(e) => e.stopPropagation()}>
              <div className="ig-story-audience-title">Share story to</div>
              <button className="ig-story-audience-opt" disabled={uploading} onClick={() => uploadStory(false)}>
                <strong>Your story</strong>
                <span>Everyone who follows you</span>
              </button>
              <button className="ig-story-audience-opt close-friends" disabled={uploading} onClick={() => uploadStory(true)}>
                <strong>Close Friends</strong>
                <span>Only people on your list</span>
              </button>
              {uploading && <div className="ig-story-audience-uploading">Posting…</div>}
            </div>
          </div>
        )}

        {groups
          .filter((g) => g.user.id !== session?.user?.id)
          .map((g) => (
            <div className="ig-story-ring-wrap" key={g.user.id}>
              <button
                className={
                  "ig-story-ring" + (!g.allSeen ? " unseen" : "") +
                  (g.stories.some((s) => s.closeFriendsOnly) ? " close-friends" : "")
                }
                onClick={() => openGroup(groups.indexOf(g))}
              >
                <Avatar name={g.user.name} src={g.user.avatarUrl} size={54} />
              </button>
              <span className="ig-story-name">{g.user.name.split(" ")[0]}</span>
            </div>
          ))}
      </div>

      {activeGroup && activeStory && (
        <div className="ig-story-viewer">
          <div className="ig-story-progress-row">
            {activeGroup.stories.map((s, i) => (
              <div className="ig-story-progress-track" key={s.id}>
                <div
                  className="ig-story-progress-fill"
                  style={{
                    width: i < viewerStoryIdx ? "100%" : i === viewerStoryIdx ? "100%" : "0%",
                    transition: i === viewerStoryIdx ? `width ${activeStory.videoUrl ? 60000 : STORY_MS}ms linear` : "none",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="ig-story-header">
            <Avatar name={activeGroup.user.name} src={activeGroup.user.avatarUrl} size={32} />
            <span className="ig-story-header-name">{activeGroup.user.name}</span>
            {activeStory.closeFriendsOnly && <span className="ig-story-cf-badge">Close Friends</span>}
            <button className="ig-story-close" onClick={closeViewer}>
              <X size={20} />
            </button>
          </div>
          <div className="ig-story-image-wrap">
            {activeStory.videoUrl ? (
              <video
                key={activeStory.id}
                className="ig-story-image"
                src={activeStory.videoUrl}
                autoPlay
                playsInline
                onEnded={() => !showSeenBy && advance()}
                style={{ objectFit: "contain", width: "100%", height: "100%" }}
              />
            ) : (
              <Image className="ig-story-image" src={activeStory.imageUrl!} alt="story" fill sizes="100vw" />
            )}
          </div>
          <button
            className="ig-story-tap-zone left"
            onClick={() => {
              if (viewerStoryIdx > 0) setViewerStoryIdx((i) => i - 1);
              else if (viewerGroupIdx! > 0) openGroup(viewerGroupIdx! - 1);
            }}
            aria-label="Previous"
          />
          <button className="ig-story-tap-zone right" onClick={advance} aria-label="Next" />

          {activeGroup.user.id === session?.user?.id ? (
            <button className="ig-story-seenby-btn" onClick={() => setShowSeenBy(true)}>
              <Eye size={14} /> Seen by
            </button>
          ) : (
            <div className="ig-story-reply-bar">
              <input
                placeholder={`Reply to ${activeGroup.user.name.split(" ")[0]}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                }}
                onKeyDown={(e) => e.key === "Enter" && sendReply(activeGroup.user.id)}
              />
              <button onClick={() => sendReply(activeGroup.user.id)} disabled={!replyText.trim() || sendingReply}>
                <Send size={16} />
              </button>
              {replySent && <span className="ig-story-reply-sent">Sent</span>}
            </div>
          )}
        </div>
      )}

      {showSeenBy && activeStory && (
        <UserListModal
          title="Seen by"
          fetchUrl={`/api/stories/${activeStory.id}/views`}
          emptyText="No views yet."
          onClose={() => setShowSeenBy(false)}
        />
      )}
      {showCloseFriends && <CloseFriendsModal onClose={() => setShowCloseFriends(false)} />}
    </>
  );
}
