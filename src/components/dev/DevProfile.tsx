"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import Avatar from "../Avatar";
import { Empty } from "../HubUI";
import { RepoCard, RepoLite } from "./DevHome";
import { call } from "@/lib/hubClient";

type Data = {
  user: { id: string; name: string; handle: string; avatarUrl?: string | null; bio: string | null };
  pinned: RepoLite[]; repos: RepoLite[];
  stats: { commits90: number; mergedPulls: number; issues: number; repos: number };
  days: Record<string, number>;
};

function heatmap(days: Record<string, number>) {
  const cells: { key: string; level: number; title: string }[] = [];
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    const n = days[key] || 0;
    cells.push({ key, level: n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 8 ? 3 : 4, title: `${n} commit${n === 1 ? "" : "s"} on ${key}` });
  }
  // Pad the front so the first column starts on a Sunday and rows are weekdays.
  const pad = new Date(cells[0].key + "T00:00:00Z").getUTCDay();
  return [...Array.from({ length: pad }, (_, i) => ({ key: `pad${i}`, level: -1, title: "" })), ...cells];
}

export default function DevProfile({ handle }: { handle: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("GET", `/api/dev/profile/${encodeURIComponent(handle)}`).then((r) => (r.ok ? setD(r.data) : setMissing(true)));
  }, [handle]);

  if (missing) return <AppShell active="hubs" hub="developer"><div className="hx-page"><Empty>That developer doesn&apos;t exist.</Empty></div></AppShell>;
  if (!d) return <AppShell active="hubs" hub="developer"><div className="hx-page"><div className="ap-loading">Loading…</div></div></AppShell>;

  return (
    <AppShell active="hubs" hub="developer">
      <div className="hx-page">
        <div className="hx-card">
          <div className="hx-row" style={{ gap: 16 }}>
            <Avatar name={d.user.name} src={d.user.avatarUrl} size={72} />
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>{d.user.name}</h1>
              <div className="hx-muted">@{d.user.handle} · <Link href={`/u/${d.user.handle}`}>Social profile</Link> · <Link href={`/connection/in/${d.user.handle}`}>Professional profile</Link></div>
              {d.user.bio && <p className="hx-post-body" style={{ marginTop: 4 }}>{d.user.bio}</p>}
            </div>
          </div>
          <div className="hx-chips" style={{ marginTop: 12 }}>
            <span className="hx-chip">{d.stats.repos} repositories</span>
            <span className="hx-chip">{d.stats.commits90} commits in 90 days</span>
            <span className="hx-chip">{d.stats.mergedPulls} merged pull requests</span>
            <span className="hx-chip">{d.stats.issues} issues opened</span>
          </div>
        </div>

        <div className="hx-card">
          <h2>Contributions</h2>
          <div className="hx-heat" aria-label="Commits over the last 90 days">
            {heatmap(d.days).map((c) => <i key={c.key} className={c.level > 0 ? `l${c.level}` : ""} style={c.level === -1 ? { visibility: "hidden" } : undefined} title={c.title} />)}
          </div>
        </div>

        {d.pinned.length > 0 && (<><h2 className="hx-section">Pinned</h2>{d.pinned.map((r) => <RepoCard key={r.id} r={r} owner={d.user.handle} />)}</>)}
        <h2 className="hx-section">Repositories</h2>
        {d.repos.length === 0 && <Empty>No repositories to show.</Empty>}
        {d.repos.map((r) => <RepoCard key={r.id} r={r} owner={d.user.handle} />)}
      </div>
    </AppShell>
  );
}
