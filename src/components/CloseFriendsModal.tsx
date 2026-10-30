"use client";
import { useEffect, useState } from "react";
import { X, Check, UserMinus } from "lucide-react";
import Avatar from "./Avatar";

type ListUser = { id: string; name: string; handle: string; avatarUrl: string | null };

// A private, editable allowlist - search adds, tapping an existing member
// removes. Nothing here is ever visible to anyone but the owner (the API
// enforces that; this is just the editor).
export default function CloseFriendsModal({ onClose }: { onClose: () => void }) {
  const [friends, setFriends] = useState<ListUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListUser[]>([]);

  useEffect(() => {
    fetch("/api/close-friends").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    });
  }, []);

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

  const friendIds = new Set((friends || []).map((f) => f.id));

  async function add(u: ListUser) {
    setFriends((prev) => (prev ? [u, ...prev] : [u]));
    await fetch("/api/close-friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
  }

  async function remove(u: ListUser) {
    setFriends((prev) => (prev ? prev.filter((f) => f.id !== u.id) : prev));
    await fetch("/api/close-friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
  }

  return (
    <div className="ig-search-overlay" onClick={onClose}>
      <div className="ig-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ig-search-head">
          <span className="ig-modal-title">Close Friends</span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ig-cf-hint">Only people on this list can see stories you share to Close Friends.</div>
        <div className="ig-search-input-row">
          <input placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="ig-search-results">
          {query.trim() && results.length === 0 && <div className="ap-loading">No results.</div>}
          {query.trim() &&
            results.map((u) => (
              <div key={u.id} className="ig-conversation-row">
                <Avatar name={u.name} src={u.avatarUrl} size={40} />
                <div className="ig-conversation-info">
                  <span className="ig-conversation-name">{u.name}</span>
                  <span className="ig-conversation-preview">@{u.handle}</span>
                </div>
                {friendIds.has(u.id) ? (
                  <button className="ig-cf-member" onClick={() => remove(u)}>
                    <Check size={14} /> Added
                  </button>
                ) : (
                  <button className="ig-cf-add" onClick={() => add(u)}>
                    Add
                  </button>
                )}
              </div>
            ))}

          {!query.trim() && (
            <>
              {friends === null && <div className="ap-loading">Loading…</div>}
              {friends !== null && friends.length === 0 && (
                <div className="ap-loading">No close friends yet - search above to add some.</div>
              )}
              {friends?.map((u) => (
                <div key={u.id} className="ig-conversation-row">
                  <Avatar name={u.name} src={u.avatarUrl} size={40} />
                  <div className="ig-conversation-info">
                    <span className="ig-conversation-name">{u.name}</span>
                    <span className="ig-conversation-preview">@{u.handle}</span>
                  </div>
                  <button className="ig-cf-remove" onClick={() => remove(u)} title="Remove">
                    <UserMinus size={16} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
