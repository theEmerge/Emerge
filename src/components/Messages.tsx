"use client";
import { useEffect, useRef, useState, useCallback, TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Search, X, Users, Smile, Film, Reply as ReplyIcon } from "lucide-react";
import ReportBlockMenu from "./ReportBlockMenu";
import Avatar from "./Avatar";
import AppShell from "./AppShell";
import EmojiPicker from "./EmojiPicker";
import GifPicker from "./GifPicker";
import { hubQuery, type HubId } from "@/lib/hubs";

type ConversationSummary = {
  id: string;
  isGroup: boolean;
  title: string;
  with: SearchUser | null;
  memberCount?: number;
  lastMessage: { text: string; gifUrl: string | null; createdAt: string; mine: boolean; senderName: string } | null;
  unread: boolean;
  updatedAt: string;
};

type ReplyPreview = { id: string; text: string; gifUrl: string | null; senderName: string };
type Reaction = { emoji: string; count: number; mine: boolean };

type Message = {
  id: string;
  text: string;
  gifUrl: string | null;
  createdAt: string;
  mine: boolean;
  sender: { id: string; name: string; handle: string };
  seenAt: string | null;
  replyTo: ReplyPreview | null;
  reactions: Reaction[];
};

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👍"];

type SearchUser = { id: string; name: string; handle: string; avatarUrl: string | null };

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Direct messages + groups. Two-pane on desktop, single-pane (list OR
// thread) on mobile - see .ig-messages-shell in globals.css. Polling-based
// (no websocket infra on serverless), same tradeoff noted in the API
// routes. Groups are just conversations with isGroup:true and 3+
// participants - same Message model, same send/read logic.
export default function Messages({ activeId, hub = "social" }: { activeId?: string; hub?: HubId }) {
  // Every hub has its own inbox; keep all links and requests inside this one.
  const hq = hubQuery(hub);
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [thread, setThread] = useState<{
    isGroup: boolean;
    title: string;
    with: SearchUser | null;
    members?: SearchUser[];
    messages: Message[];
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [dragOffsets, setDragOffsets] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingPingRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleSwipe = useRef<{ id: string; x: number; y: number } | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/conversations?hub=${hub}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
    }
    setLoadingList(false);
  }, [hub]);

  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, 8000);
    return () => clearInterval(id);
  }, [loadConversations]);

  const loadThread = useCallback(async () => {
    if (!activeId) {
      setThread(null);
      return;
    }
    const res = await fetch(`/api/conversations/${activeId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setThread({
        isGroup: data.isGroup,
        title: data.title,
        with: data.with,
        members: data.members,
        messages: data.messages || [],
      });
    }
  }, [activeId]);

  useEffect(() => {
    loadThread();
    if (!activeId) return;
    const id = setInterval(loadThread, 3000);
    return () => clearInterval(id);
  }, [activeId, loadThread]);

  // Separate, faster poll for typing state - 3s (message poll cadence)
  // would feel laggy for "is typing now", 1.5s is closer to instant
  // without hammering Redis.
  useEffect(() => {
    if (!activeId || !thread) {
      setTypingNames([]);
      return;
    }
    const nameFor = (id: string) => {
      if (thread.isGroup) return thread.members?.find((m) => m.id === id)?.name ?? "Someone";
      return thread.with?.name ?? "Someone";
    };
    const poll = async () => {
      const res = await fetch(`/api/conversations/${activeId}/typing`);
      if (res.ok) {
        const data = await res.json();
        setTypingNames((data.typingUserIds || []).map(nameFor));
      }
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [activeId, thread?.isGroup, thread?.members, thread?.with]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.users || []);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function sendMessage(payload: { text?: string; gifUrl?: string; replyToId?: string }) {
    if (!activeId) return;
    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const message = await res.json();
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
      loadConversations();
    } else if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      alert(body.error === "email_not_verified" ? "Your email isn't verified yet. Log out and log back in with the emailed code." : "You can't message this person.");
    }
  }

  async function send() {
    if (!draft.trim()) return;
    const text = draft.trim();
    const replyToId = replyTarget?.id;
    setDraft("");
    setReplyTarget(null);
    await sendMessage({ text, ...(replyToId ? { replyToId } : {}) });
  }

  function pingTyping() {
    if (!activeId) return;
    const now = Date.now();
    if (now - lastTypingPingRef.current < 2000) return;
    lastTypingPingRef.current = now;
    fetch(`/api/conversations/${activeId}/typing`, { method: "POST" }).catch(() => {});
  }

  async function react(messageId: string, emoji: string, alreadyMine: boolean) {
    setReactionPickerId(null);
    // Optimistic update so the tap feels instant instead of waiting on the
    // next 3s thread poll.
    setThread((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) => {
          if (m.id !== messageId) return m;
          const withoutMine = m.reactions.filter((r) => !r.mine).map((r) => ({ ...r }));
          if (alreadyMine) return { ...m, reactions: withoutMine };
          const existing = withoutMine.find((r) => r.emoji === emoji);
          const next = existing
            ? withoutMine.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
            : [...withoutMine, { emoji, count: 1, mine: true }];
          return { ...m, reactions: next };
        }),
      };
    });
    if (alreadyMine) {
      await fetch(`/api/messages/${messageId}/react`, { method: "DELETE" });
    } else {
      await fetch(`/api/messages/${messageId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    }
    loadThread();
  }

  function pickEmoji(emoji: string) {
    setDraft((d) => d + emoji);
    setShowEmoji(false);
  }

  async function pickGif(url: string) {
    setShowGif(false);
    await sendMessage({ gifUrl: url });
  }

  function closeNewMessagePanel() {
    setSearchOpen(false);
    setGroupMode(false);
    setQuery("");
    setResults([]);
    setSelected([]);
    setGroupName("");
  }

  async function startWith(user: SearchUser) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, hub }),
    });
    if (res.ok) {
      const { id } = await res.json();
      closeNewMessagePanel();
      router.push(`/messages/${id}${hq}`);
    }
  }

  function toggleSelected(user: SearchUser) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function createGroup() {
    if (selected.length < 2 || !groupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selected.map((u) => u.id), name: groupName.trim(), hub }),
      });
      if (res.ok) {
        const { id } = await res.json();
        closeNewMessagePanel();
        router.push(`/messages/${id}${hq}`);
      }
    } finally {
      setCreatingGroup(false);
    }
  }

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const threadListTouchActive = useRef(false);

  function onThreadTouchStart(e: TouchEvent) {
    // A bubble-swipe is already in progress (tracked separately below) -
    // don't also treat this as a swipe-back attempt.
    if (threadListTouchActive.current) return;
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onThreadTouchEnd(e: TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    // Instagram-style swipe-back: a deliberate rightward drag, not a
    // vertical scroll gesture, and only from close to the left edge so it
    // doesn't fight with normal message-list scrolling mid-thread.
    if (dx > 70 && Math.abs(dy) < 60 && start.x < 60) {
      router.push(`/messages${hq}`);
    }
  }

  // Swipe any bubble rightward to reply to it (WhatsApp/Instagram
  // pattern) - tracked per-message so multiple rows don't fight, with a
  // small live drag offset for visual feedback while dragging.
  function onBubbleTouchStart(m: Message) {
    return (e: TouchEvent) => {
      threadListTouchActive.current = true;
      bubbleSwipe.current = { id: m.id, x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
  }
  function onBubbleTouchMove(m: Message) {
    return (e: TouchEvent) => {
      const start = bubbleSwipe.current;
      if (!start || start.id !== m.id) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (Math.abs(dy) > 40) return; // vertical scroll, not a reply swipe
      const clamped = Math.max(0, Math.min(dx, 64));
      setDragOffsets((prev) => ({ ...prev, [m.id]: clamped }));
    };
  }
  function onBubbleTouchEnd(m: Message) {
    return (e: TouchEvent) => {
      const start = bubbleSwipe.current;
      bubbleSwipe.current = null;
      threadListTouchActive.current = false;
      const offset = dragOffsets[m.id] || 0;
      setDragOffsets((prev) => ({ ...prev, [m.id]: 0 }));
      if (start && start.id === m.id && offset > 48) {
        setReplyTarget(m);
      }
    };
  }

  function onBubbleLongPressStart(id: string) {
    return () => {
      longPressTimerRef.current = setTimeout(() => setReactionPickerId(id), 450);
    };
  }
  function onBubbleLongPressEnd() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }

  return (
    <AppShell active="messages" hub={hub}>
      <div className="ig-messages-shell">
        <div className={"ig-messages-track" + (activeId ? " ig-track-thread" : "")}>
        <div className="ig-messages-list">
          <div className="ig-messages-list-head">
            <span>Messages</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setSearchOpen(true)} title="New message">
                <Search size={18} />
              </button>
              <button onClick={() => { setSearchOpen(true); setGroupMode(true); }} title="New group">
                <Users size={18} />
              </button>
            </div>
          </div>

          {loadingList && <div className="ap-loading">Loading…</div>}
          {!loadingList && conversations.length === 0 && (
            <div className="ap-sugg-sub" style={{ padding: "12px 16px" }}>
              No conversations yet - search for someone to message.
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              className={"ig-conversation-row" + (c.id === activeId ? " active" : "")}
              onClick={() => router.push(`/messages/${c.id}${hq}`)}
            >
              <Avatar name={c.title || "?"} src={c.isGroup ? null : c.with?.avatarUrl} size={44} />
              <div className="ig-conversation-info">
                <span className="ig-conversation-name">
                  {c.title}
                  {c.isGroup && <span className="ig-conversation-member-count"> · {c.memberCount} members</span>}
                </span>
                <span className="ig-conversation-preview">
                  {c.lastMessage
                    ? `${c.lastMessage.mine ? "You" : c.isGroup ? c.lastMessage.senderName : ""}${
                        c.lastMessage.mine || c.isGroup ? ": " : ""
                      }${c.lastMessage.gifUrl ? "GIF" : c.lastMessage.text}`
                    : "Say hello"}
                </span>
              </div>
              {c.unread && <span className="ig-badge" />}
            </button>
          ))}
        </div>

        <div
          className="ig-messages-thread"
          onTouchStart={onThreadTouchStart}
          onTouchEnd={onThreadTouchEnd}
        >
          {activeId && thread && (
            <>
              <div className="ig-thread-head">
                <button className="ig-thread-back" onClick={() => router.push(`/messages${hq}`)}>
                  <ArrowLeft size={18} />
                </button>
                <Avatar name={thread.title || "?"} src={thread.isGroup ? null : thread.with?.avatarUrl} size={32} />
                <span>
                  {thread.title || "Unknown"}
                  {thread.isGroup && thread.members && (
                    <span className="ig-conversation-member-count"> · {thread.members.length + 1} members</span>
                  )}
                </span>
                {!thread.isGroup && thread.with && (
                  <span style={{ marginLeft: "auto" }}>
                    <ReportBlockMenu
                      target={{ type: "USER", id: thread.with.id }}
                      userId={thread.with.id}
                      handle={thread.with.handle}
                      onBlocked={() => { window.location.href = `/messages${hq}`; }}
                    />
                  </span>
                )}
              </div>
              <div className="ig-thread-messages" onClick={() => reactionPickerId && setReactionPickerId(null)}>
                {thread.messages.map((m, i) => {
                  const isLast = i === thread.messages.length - 1;
                  const prev = thread.messages[i - 1];
                  const next = thread.messages[i + 1];
                  const GROUP_GAP_MS = 5 * 60 * 1000;
                  const sameGroupAsPrev =
                    !!prev && prev.mine === m.mine && prev.sender.id === m.sender.id &&
                    new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS;
                  const sameGroupAsNext =
                    !!next && next.mine === m.mine && next.sender.id === m.sender.id &&
                    new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() < GROUP_GAP_MS;
                  const isGroupStart = !sameGroupAsPrev;
                  const isGroupEnd = !sameGroupAsNext;
                  const dragX = dragOffsets[m.id] || 0;
                  return (
                    <div
                      key={m.id}
                      className={
                        "ig-bubble-row" +
                        (m.mine ? " mine" : "") +
                        (isGroupStart ? " group-start" : "") +
                        (isGroupEnd ? " group-end" : "")
                      }
                    >
                      <div
                        className="ig-bubble-swipe-wrap"
                        style={dragX ? { transform: `translateX(${dragX}px)` } : undefined}
                        onTouchStart={(e) => {
                          onBubbleTouchStart(m)(e);
                          onBubbleLongPressStart(m.id)();
                        }}
                        onTouchMove={onBubbleTouchMove(m)}
                        onTouchEnd={(e) => {
                          onBubbleTouchEnd(m)(e);
                          onBubbleLongPressEnd();
                        }}
                        onDoubleClick={() => {
                          const mine = m.reactions.find((r) => r.mine);
                          react(m.id, mine ? mine.emoji : "❤️", !!mine);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setReactionPickerId(m.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {dragX > 20 && <ReplyIcon size={16} className="ig-bubble-swipe-hint" />}
                        <div className={m.gifUrl ? "ig-bubble ig-bubble-gif" : "ig-bubble"}>
                          {thread.isGroup && !m.mine && isGroupStart && (
                            <div className="ig-bubble-sender">{m.sender.name}</div>
                          )}
                          {m.replyTo && (
                            <div className="ig-bubble-reply-quote">
                              <span className="ig-bubble-reply-name">{m.replyTo.senderName}</span>
                              <span>{m.replyTo.gifUrl ? "GIF" : m.replyTo.text}</span>
                            </div>
                          )}
                          {m.gifUrl ? <img src={m.gifUrl} alt="gif" /> : m.text}
                        </div>
                        {reactionPickerId === m.id && (
                          <div className="ig-reaction-picker" onClick={(e) => e.stopPropagation()}>
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  const mine = m.reactions.find((r) => r.mine && r.emoji === emoji);
                                  react(m.id, emoji, !!mine);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              className="ig-reaction-picker-reply"
                              onClick={() => {
                                setReplyTarget(m);
                                setReactionPickerId(null);
                              }}
                            >
                              <ReplyIcon size={14} />
                            </button>
                            {!m.mine && (
                              <ReportBlockMenu
                                target={{ type: "MESSAGE", id: m.id }}
                                userId={m.sender.id}
                                handle={m.sender.handle}
                                size={14}
                                label="Report message"
                                onBlocked={() => { window.location.href = `/messages${hq}`; }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      {m.reactions.length > 0 && (
                        <div className="ig-bubble-reactions">
                          {m.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              className={"ig-reaction-badge" + (r.mine ? " mine" : "")}
                              onClick={() => react(m.id, r.emoji, r.mine)}
                            >
                              {r.emoji} {r.count > 1 ? r.count : ""}
                            </button>
                          ))}
                        </div>
                      )}
                      {isLast && m.mine && (
                        <div className="ig-receipt">{m.seenAt ? `Seen ${timeAgo(m.seenAt)}` : "Sent"}</div>
                      )}
                      {!isLast && isGroupEnd && (
                        <div className="ig-bubble-timestamp">{timeAgo(m.createdAt)}</div>
                      )}
                    </div>
                  );
                })}
                {typingNames.length > 0 && (
                  <div className="ig-typing-indicator">
                    <span className="ig-typing-dot" />
                    <span className="ig-typing-dot" />
                    <span className="ig-typing-dot" />
                    {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              {replyTarget && (
                <div className="ig-reply-preview">
                  <div className="ig-reply-preview-body">
                    <span className="ig-bubble-reply-name">{replyTarget.mine ? "You" : replyTarget.sender.name}</span>
                    <span>{replyTarget.gifUrl ? "GIF" : replyTarget.text}</span>
                  </div>
                  <button onClick={() => setReplyTarget(null)} aria-label="Cancel reply">
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="ig-thread-composer">
                <button className="ig-composer-icon-btn" onClick={() => setShowEmoji((v) => !v)} title="Emoji">
                  <Smile size={19} />
                </button>
                <button className="ig-composer-icon-btn" onClick={() => setShowGif(true)} title="GIF">
                  <Film size={19} />
                </button>
                <input
                  placeholder="Message..."
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    pingTyping();
                  }}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button className="ig-thread-send-btn" onClick={send} disabled={!draft.trim()}>
                  <Send size={16} />
                </button>
                {showEmoji && <EmojiPicker onPick={pickEmoji} onClose={() => setShowEmoji(false)} />}
              </div>
              {showGif && <GifPicker onPick={pickGif} onClose={() => setShowGif(false)} />}
            </>
          )}
          {!activeId && (
            <div className="ig-thread-empty">
              <Send size={40} strokeWidth={1.2} />
              <p>Select a conversation, or start a new one.</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {searchOpen && (
        <div className="ig-search-overlay" onClick={closeNewMessagePanel}>
          <div className="ig-search-panel" onClick={(e) => e.stopPropagation()}>
            <div className="ig-search-tabs">
              <button className={!groupMode ? "active" : ""} onClick={() => setGroupMode(false)}>
                Direct message
              </button>
              <button className={groupMode ? "active" : ""} onClick={() => setGroupMode(true)}>
                New group
              </button>
            </div>

            {groupMode && (
              <div className="ig-group-name-row">
                <input
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={60}
                />
              </div>
            )}

            {groupMode && selected.length > 0 && (
              <div className="ig-selected-chips">
                {selected.map((u) => (
                  <button key={u.id} className="ig-selected-chip" onClick={() => toggleSelected(u)}>
                    {u.name} <X size={12} />
                  </button>
                ))}
              </div>
            )}

            <div className="ig-search-head">
              <input
                autoFocus
                placeholder="Search by name or @handle"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={closeNewMessagePanel} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="ig-search-results">
              {results.map((u) => {
                const isSelected = selected.some((s) => s.id === u.id);
                return (
                  <button
                    key={u.id}
                    className={"ig-conversation-row" + (isSelected ? " active" : "")}
                    onClick={() => (groupMode ? toggleSelected(u) : startWith(u))}
                  >
                    <Avatar name={u.name} src={u.avatarUrl} size={40} />
                    <div className="ig-conversation-info">
                      <span className="ig-conversation-name">{u.name}</span>
                      <span className="ig-conversation-preview">@{u.handle}</span>
                    </div>
                    {groupMode && isSelected && <span className="ig-selected-check">✓</span>}
                  </button>
                );
              })}
              {query.trim().length > 0 && results.length === 0 && (
                <div className="ap-sugg-sub" style={{ padding: "12px 16px" }}>No matches.</div>
              )}
            </div>

            {groupMode && (
              <div className="ig-group-create-row">
                <button
                  className="ap-post-btn"
                  disabled={selected.length < 2 || !groupName.trim() || creatingGroup}
                  onClick={createGroup}
                >
                  {creatingGroup ? "Creating…" : `Create group${selected.length ? ` (${selected.length})` : ""}`}
                </button>
                <div className="ap-sugg-sub">Pick at least 2 people to start a group.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
