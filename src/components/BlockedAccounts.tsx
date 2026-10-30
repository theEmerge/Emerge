"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "./Avatar";

type U = { id: string; name: string; handle: string; avatarUrl: string | null };

// Settings > Blocked accounts: see who you've blocked and unblock them.
export default function BlockedAccounts() {
  const [users, setUsers] = useState<U[] | null>(null);

  useEffect(() => {
    fetch("/api/blocks")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]));
  }, []);

  async function unblock(id: string) {
    const res = await fetch(`/api/blocks?userId=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setUsers((prev) => (prev || []).filter((u) => u.id !== id));
  }

  return (
    <>
      <h2 className="ig-settings-h2">Blocked accounts</h2>
      <div className="ig-settings-card">
        {users === null && <div className="ap-loading">Loading…</div>}
        {users?.length === 0 && <div className="ap-sugg-sub" style={{ padding: 12 }}>You haven&apos;t blocked anyone.</div>}
        {users?.map((u) => (
          <div key={u.id} className="ig-settings-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={u.name} src={u.avatarUrl} size={32} />
            <Link href={`/u/${u.handle}`} style={{ flex: 1 }}>@{u.handle}</Link>
            <button className="ap-icon-btn" onClick={() => unblock(u.id)}>Unblock</button>
          </div>
        ))}
      </div>
    </>
  );
}
