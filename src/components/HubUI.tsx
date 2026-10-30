"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Avatar from "./Avatar";
import { Stat, type IconName } from "./hubdesign/parts";

export type PersonLite = { id: string; name: string; handle: string; avatarUrl?: string | null };

// A person with an avatar, linking to their profile in the current hub.
export function PersonRow({
  user, href, sub, children,
}: { user: PersonLite; href: string; sub?: string | null; children?: React.ReactNode }) {
  return (
    <div className="hx-person">
      <Link href={href} className="hx-person-main">
        <Avatar name={user.name} src={user.avatarUrl} size={44} />
        <span className="hx-person-text">
          <b>{user.name}</b>
          <span className="hx-muted">{sub || `@${user.handle}`}</span>
        </span>
      </Link>
      {children && <div className="hx-person-actions">{children}</div>}
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="hx-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="hx-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="hx-empty">{children}</div>;
}

export function ErrorLine({ text }: { text: string | null }) {
  return text ? <p className="hx-err" role="alert">{text}</p> : null;
}


// Heading block at the top of each hub home (Figma "welcome grid"): eyebrow, headline,
// a line of text and the primary action on the right.
export function HubWelcome({ eyebrow, lead, accent, body, action }: { eyebrow: string; lead: string; accent: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="hd-welcome-grid">
      <div className="hd-welcome-copy">
        <p className="hd-eyebrow">{eyebrow}</p>
        <h2>{lead}{accent}</h2>
        <p>{body}</p>
      </div>
      {action}
    </section>
  );
}

export function greeting(name?: string | null) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = (name || "").split(" ")[0];
  return { lead: `${part}, `, accent: first ? `${first}.` : "there." };
}

const STAT_ICONS: Record<string, IconName> = {
  connections: "people", pending: "link", applicants: "briefcase", events: "calendar",
  repos: "branch", issues: "explore", pulls: "link", commits: "code",
  joined: "server", owned: "star", friends: "people", lfg: "controller",
};
const STAT_NOTES: Record<string, string> = {
  connections: "Accepted connections", pending: "All caught up", events: "Upcoming RSVPs", applicants: "On your listings",
};

type StatItem = { key: string; label: string; value: number; note?: string };

// A row of real counts for the hub home page (connections, repos, servers...).
export function HubStats({ hub, keys }: { hub: "connection" | "developer" | "game"; keys?: string[] }) {
  const [stats, setStats] = useState<StatItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/hub/stats?hub=${hub}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.stats) setStats(d.stats); })
      .catch(() => {});
    return () => { alive = false; };
  }, [hub]);
  const shown = stats && (keys ? keys.map((k) => stats.find((s) => s.key === k)).filter((s): s is StatItem => !!s) : stats.slice(0, 3));
  if (!shown) return <section className="hd-stats-grid" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="hd-stat-card hd-skeleton" />)}</section>;
  return (
    <section className="hd-stats-grid">
      {shown.map((s) => (
        <Stat key={s.key} icon={STAT_ICONS[s.key] ?? "grid"} label={s.label} value={s.value.toLocaleString()} note={s.note ?? STAT_NOTES[s.key]} />
      ))}
    </section>
  );
}
