"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Avatar from "./Avatar";

export type TagUser = { id: string; name: string; handle: string; avatarUrl: string | null };

// Multi-select "who's in this post/reel" picker - used from the Feed
// composer and the Reels upload flow. Selection lives in the parent
// (selected/onChange) so it survives the picker opening and closing.
export default function TagPicker({
  selected,
  onChange,
  onClose,
  doneLabel = "Done",
}: {
  selected: TagUser[];
  onChange: (users: TagUser[]) => void;
  onClose: () => void;
  doneLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TagUser[]>([]);

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

  function toggle(u: TagUser) {
    const exists = selected.some((s) => s.id === u.id);
    onChange(exists ? selected.filter((s) => s.id !== u.id) : [...selected, u]);
  }

  return (
    <div className="ig-search-overlay" onClick={onClose}>
      <div className="ig-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ig-search-head">
          <span className="ig-modal-title">Tag people</span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {selected.length > 0 && (
          <div className="ig-selected-chips">
            {selected.map((u) => (
              <button key={u.id} className="ig-selected-chip" onClick={() => toggle(u)}>
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
        </div>
        <div className="ig-search-results">
          {results.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            return (
              <button
                key={u.id}
                className={"ig-conversation-row" + (isSelected ? " active" : "")}
                onClick={() => toggle(u)}
              >
                <Avatar name={u.name} src={u.avatarUrl} size={40} />
                <div className="ig-conversation-info">
                  <span className="ig-conversation-name">{u.name}</span>
                  <span className="ig-conversation-preview">@{u.handle}</span>
                </div>
                {isSelected && <span className="ig-selected-check">✓</span>}
              </button>
            );
          })}
          {query.trim().length > 0 && results.length === 0 && (
            <div className="ap-sugg-sub" style={{ padding: "12px 16px" }}>No matches.</div>
          )}
        </div>

        <div className="ig-group-create-row">
          <button className="ap-post-btn" onClick={onClose}>
            {doneLabel}{selected.length ? ` (${selected.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
