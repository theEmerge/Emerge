"use client";
import { useEffect, useState } from "react";
import { X, Link2, CircleDot, Check } from "lucide-react";
import Avatar from "./Avatar";

type ConversationSummary = {
  id: string;
  isGroup: boolean;
  title: string;
  with: { id: string; name: string; handle: string; avatarUrl: string | null } | null;
};

// Instagram-style share sheet: send directly into a DM, add to your own
// story (reels only carry videoUrl, posts carry imageUrl - either works
// since Story now supports both), or just copy the link.
export default function ShareSheet({
  reelId,
  videoUrl,
  onClose,
}: {
  reelId: string;
  videoUrl: string;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [addingToStory, setAddingToStory] = useState(false);
  const [addedToStory, setAddedToStory] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/reels?open=${reelId}` : "";

  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations || []));
  }, []);

  async function sendTo(conversationId: string) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: shareUrl }),
    });
    if (res.ok) setSentTo((prev) => new Set(prev).add(conversationId));
  }

  async function addToStory() {
    setAddingToStory(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      if (res.ok) setAddedToStory(true);
    } finally {
      setAddingToStory(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="ig-search-overlay" onClick={onClose}>
      <div className="ig-share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ig-search-head">
          <span className="ig-modal-title">Share</span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <button className="ig-share-story-row" onClick={addToStory} disabled={addingToStory || addedToStory}>
          <span className="ig-new-post-icon story">
            <CircleDot size={18} />
          </span>
          <span>{addedToStory ? "Added to your story" : addingToStory ? "Adding…" : "Add to your story"}</span>
          {addedToStory && <Check size={16} className="ig-share-check" />}
        </button>

        <div className="ig-share-conversations">
          {conversations === null && <div className="ap-loading">Loading…</div>}
          {conversations !== null && conversations.length === 0 && (
            <div className="ap-sugg-sub" style={{ padding: "12px 16px" }}>
              No conversations yet.
            </div>
          )}
          {conversations?.map((c) => (
            <div className="ig-conversation-row" key={c.id}>
              <Avatar name={c.title} src={c.isGroup ? null : c.with?.avatarUrl} size={40} />
              <div className="ig-conversation-info">
                <span className="ig-conversation-name">{c.title}</span>
              </div>
              <button
                className="ig-share-send-btn"
                onClick={() => sendTo(c.id)}
                disabled={sentTo.has(c.id)}
              >
                {sentTo.has(c.id) ? "Sent" : "Send"}
              </button>
            </div>
          ))}
        </div>

        <button className="ig-share-story-row" onClick={copyLink}>
          <span className="ig-new-post-icon post">
            <Link2 size={18} />
          </span>
          <span>{copied ? "Link copied" : "Copy link"}</span>
        </button>
      </div>
    </div>
  );
}
