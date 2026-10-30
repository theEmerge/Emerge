"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import Avatar from "./Avatar";

type ListUser = { id: string; name: string; handle: string; avatarUrl: string | null };

// Generic "list of users in an overlay panel" - powers likes, followers,
// and following lists alike, each just pointing it at a different
// fetch URL.
export default function UserListModal({
  title,
  fetchUrl,
  emptyText,
  onClose,
}: {
  title: string;
  fetchUrl: string;
  emptyText: string;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<ListUser[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(fetchUrl).then(async (res) => {
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setUsers(data.users || []);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  return (
    <div className="ig-search-overlay" onClick={onClose}>
      <div className="ig-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ig-search-head">
          <span className="ig-modal-title">{title}</span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ig-search-results">
          {users === null && <div className="ap-loading">Loading…</div>}
          {users !== null && users.length === 0 && <div className="ap-loading">{emptyText}</div>}
          {users?.map((u) => (
            <Link key={u.id} href={`/u/${u.handle}`} className="ig-conversation-row" onClick={onClose}>
              <Avatar name={u.name} src={u.avatarUrl} size={40} />
              <div className="ig-conversation-info">
                <span className="ig-conversation-name">{u.name}</span>
                <span className="ig-conversation-preview">@{u.handle}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
