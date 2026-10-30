"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import { Empty, PersonLite, HubWelcome, HubStats, greeting } from "../HubUI";
import { HdAvatar, Icon } from "../hubdesign/parts";
import { TEAM_IMG } from "../hubdesign/images";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";
import { useSession } from "next-auth/react";

type Post = { id: string; body: string; createdAt: string; author: PersonLite & { proProfile: { headline: string | null } | null } };

type Suggestion = { user: PersonLite & { proProfile: { headline: string | null } | null }; mutual: number };
type NextEvent = { id: string; title: string; description: string; location: string | null; isOnline: boolean; startsAt: string; goingCount: number };

export default function ConnectionFeed() {
  const router = useRouter();
  const { data: session } = useSession();
  const composer = useRef<HTMLTextAreaElement>(null);
  const [strength, setStrength] = useState<{ percent: number; next: string | null } | null>(null);
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const [people, setPeople] = useState<Suggestion[]>([]);
  const [sent, setSent] = useState<string[]>([]);

  useEffect(() => {
    call("GET", "/api/hub/overview?hub=connection").then((r) => r.ok && setStrength(r.data.strength));
    call("GET", "/api/connection/events?scope=upcoming").then((r) => r.ok && setNextEvent(r.data.events?.[0] ?? null));
    call("GET", "/api/connection/network").then((r) => r.ok && setPeople((r.data.suggestions || []).slice(0, 3)));
  }, []);

  async function connect(userId: string) {
    const r = await call("POST", "/api/connection/network", { action: "request", userId });
    if (r.ok) setSent((s) => [...s, userId]);
  }
  function startPost() {
    composer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    composer.current?.focus();
  }
  const hello = greeting(session?.user?.name);
  const [scope, setScope] = useState<"connections" | "all">("connections");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (reset: boolean, from: string | null) => {
    const r = await call("GET", `/api/connection/feed?scope=${scope}${from ? `&cursor=${from}` : ""}`);
    if (!r.ok) return setErr(errorText(r.data));
    setPosts((prev) => (reset || !prev ? r.data.posts : [...prev, ...r.data.posts]));
    setCursor(r.data.nextCursor);
  }, [scope]);

  useEffect(() => {
    setPosts(null);
    load(true, null);
  }, [load]);

  async function publish() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const r = await call("POST", "/api/connection/feed", { body: draft });
    setBusy(false);
    if (!r.ok) return setErr(errorText(r.data));
    setDraft("");
    setPosts((prev) => [r.data.post, ...(prev || [])]);
  }

  async function remove(id: string) {
    await call("DELETE", `/api/connection/feed?id=${id}`);
    setPosts((prev) => (prev || []).filter((p) => p.id !== id));
  }

  // A closing line made only of #tags is shown as chips instead of repeating it in the text.
  function splitTags(text: string): { copy: string; tags: string[] } {
    const lines = text.trimEnd().split("\n");
    const last = lines[lines.length - 1].trim();
    if (last && last.split(/\s+/).every((w) => /^#[\p{L}\p{N}_]+$/u.test(w))) {
      return { copy: lines.slice(0, -1).join("\n").trimEnd(), tags: last.split(/\s+/).slice(0, 3) };
    }
    return { copy: text, tags: [] };
  }

  return (
    <AppShell active="hubs" hub="connection">
      <HubWelcome
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        lead={hello.lead}
        accent={hello.accent}
        body="Your network is moving. Catch up on what matters and make your next meaningful connection."
        action={<button className="hd-primary-action" onClick={startPost}><Icon name="plus" size={18} /> Share an update</button>}
      />
      <HubStats hub="connection" keys={["connections", "pending", "events"]} />

      <section className="hd-content-grid">
        <div className="hd-main-column">
          <article className="hd-feature-card hd-professional-feature">
            <img src={TEAM_IMG} alt="" />
            <div className="hd-feature-overlay">
              <span className="hd-live-label"><span /> {nextEvent ? "Next event" : "Hiring on Emerge"}</span>
              <h3>{nextEvent ? nextEvent.title : "Find your next opportunity"}</h3>
              <p>
                {nextEvent
                  ? `${new Date(nextEvent.startsAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${nextEvent.isOnline ? "Online" : nextEvent.location} · ${nextEvent.goingCount} going`
                  : "Roles are listed newest first. Nothing is ranked or paid to rank higher."}
              </p>
              <button onClick={() => router.push(nextEvent ? "/connection/events" : "/connection/jobs")}>
                {nextEvent ? "See events" : "Browse jobs"} <Icon name="arrow" size={17} />
              </button>
            </div>
          </article>

          <div className="hd-section-heading">
            <div>
              <p className="hd-eyebrow">From your circle</p>
              <h3>Network pulse</h3>
            </div>
            <div className="hd-seg" role="group" aria-label="Whose posts">
              <button className={scope === "connections" ? "hd-on" : ""} onClick={() => setScope("connections")}>Connections</button>
              <button className={scope === "all" ? "hd-on" : ""} onClick={() => setScope("all")}>Everyone</button>
            </div>
          </div>

          {posts === null && <div className="ap-loading">Loading…</div>}
          {posts?.length === 0 && (
            <Empty>{scope === "connections" ? "Nothing here yet. Connect with people in the Network tab, or switch to Everyone." : "No posts yet. Be the first."}</Empty>
          )}
          {posts?.map((p) => {
            const { copy, tags } = splitTags(p.body);
            return (
            <article className="hd-feed-card" key={p.id} style={{ marginBottom: 12 }}>
              <div className="hd-feed-author">
                <Link href={`/connection/in/${p.author.handle}`} style={{ display: "contents" }}>
                  <HdAvatar name={p.author.name} src={p.author.avatarUrl} />
                  <div>
                    <strong>{p.author.name}</strong>
                    <span>{p.author.proProfile?.headline || `@${p.author.handle}`} · {timeAgo(p.createdAt)}</span>
                  </div>
                </Link>
                {p.author.id === session?.user?.id && (
                  <button className="hd-icon-plain" aria-label="Delete post" title="Delete post" onClick={() => remove(p.id)}>
                    <Icon name="trash" size={18} />
                  </button>
                )}
              </div>
              {copy && <p className="hd-feed-copy">{copy}</p>}
              {tags.length > 0 && <div className="hd-topic-row">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
            </article>
            );
          })}
          {cursor && <button className="hd-btn" style={{ width: "100%" }} onClick={() => load(false, cursor)}>Load more</button>}
        </div>

        <aside className="hd-dashboard-rail">
          <div className="hd-rail-card hd-profile-card">
            <div className="hd-profile-progress" style={{ ["--p" as string]: strength?.percent ?? 0 }}>
              <span>{strength ? `${strength.percent}%` : "…"}</span>
            </div>
            <div>
              <p className="hd-eyebrow">Profile strength</p>
              <h3>{strength && strength.percent >= 100 ? "All-star profile" : "You're almost there"}</h3>
              <p>{strength?.next ? `Next: ${strength.next.toLowerCase()}.` : "Your profile is complete."}</p>
            </div>
            <button onClick={() => router.push(`/connection/in/${session?.user?.handle ?? ""}`)}>
              Complete profile <Icon name="arrow" size={16} />
            </button>
          </div>

          <div className="hd-rail-card">
            <div className="hd-section-heading hd-compact">
              <div>
                <p className="hd-eyebrow">Suggested</p>
                <h3>People to know</h3>
              </div>
              <Link href="/connection/network" className="hd-link-btn">See all</Link>
            </div>
            {people.length === 0 && <p className="hd-rail-note" style={{ marginTop: 0 }}>Connect with a few people and suggestions will appear here.</p>}
            {people.map((s) => (
              <div className="hd-person-row" key={s.user.id}>
                <Link href={`/connection/in/${s.user.handle}`} className="hd-person-main">
                  <HdAvatar name={s.user.name} src={s.user.avatarUrl} />
                  <div>
                    <strong>{s.user.name}</strong>
                    <span>{s.user.proProfile?.headline || `@${s.user.handle}`}{s.mutual ? ` · ${s.mutual} mutual` : ""}</span>
                  </div>
                </Link>
                <button className={sent.includes(s.user.id) ? "hd-connected" : ""} onClick={() => connect(s.user.id)} disabled={sent.includes(s.user.id)} aria-label={`Connect with ${s.user.name}`}>
                  <Icon name={sent.includes(s.user.id) ? "check" : "plus"} size={17} />
                </button>
              </div>
            ))}
          </div>

          <div className="hd-rail-card hd-quick-post">
            <p className="hd-eyebrow">Quick share</p>
            <h3>What are you learning?</h3>
            <textarea ref={composer} aria-label="Share an update" placeholder="A lesson, idea or small win..." maxLength={3000} value={draft} onChange={(e) => setDraft(e.target.value)} />
            {err && <p className="hd-err" role="alert" style={{ marginTop: 8 }}>{err}</p>}
            <button disabled={busy || !draft.trim()} onClick={publish}>{busy ? "Posting…" : "Post to network"}</button>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
