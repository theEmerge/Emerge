"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import { Empty, PersonLite, HubWelcome } from "../HubUI";
import { HdAvatar, Icon } from "../hubdesign/parts";
import { GAME_IMG } from "../hubdesign/images";
import { useSession } from "next-auth/react";
import { call, errorText } from "@/lib/hubClient";

type Srv = { id: string; name: string; description: string | null; memberCount: number; role?: string };
type Friend = { user: PersonLite; game: string };

type Lfg = { id: string; game: string; title: string; slots: number; players: PersonLite[]; author: PersonLite };
const LOGO_COLORS = ["purple", "orange", "blue"] as const;
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const logoColor = (id: string) => LOGO_COLORS[Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0) % LOGO_COLORS.length];

export default function GameHome() {
  const router = useRouter();
  const { data: session } = useSession();
  const [lfg, setLfg] = useState<Lfg | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    call("GET", "/api/game/lfg").then((r) => r.ok && setLfg(r.data.posts?.[0] ?? null));
  }, []);
  const [mine, setMine] = useState<Srv[] | null>(null);
  const [discover, setDiscover] = useState<Srv[]>([]);
  const [playing, setPlaying] = useState("");
  const [savedPlaying, setSavedPlaying] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [code, setCode] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", isPublic: true });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([call("GET", "/api/game/servers"), call("GET", "/api/game/presence")]);
    if (s.ok) { setMine(s.data.mine); setDiscover(s.data.discover); }
    if (p.ok) { setFriends(p.data.friends); setSavedPlaying(p.data.mine); setPlaying(p.data.mine || ""); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createServer() {
    setErr(null);
    const r = await call("POST", "/api/game/servers", form);
    if (!r.ok) return setErr(errorText(r.data));
    router.push(`/game/s/${r.data.server.id}`);
  }
  async function joinCode() {
    setErr(null);
    const r = await call("POST", "/api/game/servers/join", { code });
    if (!r.ok) return setErr(errorText(r.data));
    router.push(`/game/s/${r.data.id}`);
  }
  async function joinPublic(id: string) {
    const r = await call("POST", `/api/game/servers/${id}`, { action: "join" });
    if (!r.ok) return setErr(errorText(r.data));
    router.push(`/game/s/${id}`);
  }
  async function setStatus(game: string) {
    setErr(null);
    const r = await call("PUT", "/api/game/presence", { game });
    if (!r.ok) return setErr(errorText(r.data));
    setSavedPlaying(r.data.game);
    if (!game) setPlaying("");
  }

  const joinedIds = new Set((mine || []).map((m) => m.id));
  const found = discover.filter((d) => !joinedIds.has(d.id));
  const shown = showAll ? found : found.slice(0, 4);

  const card = (s: Srv, mineCard: boolean) => (
    <article className="hd-server-card" key={s.id}>
      <div className={`hd-server-logo hd-${logoColor(s.id)}`}>{initials(s.name)}</div>
      <div className="hd-server-info">
        <strong>{mineCard ? <Link href={`/game/s/${s.id}`}>{s.name}</Link> : s.name}</strong>
        <span>{s.description || (mineCard ? s.role : "Public server")}</span>
      </div>
      <span className="hd-online">{s.memberCount} member{s.memberCount === 1 ? "" : "s"}{mineCard && s.role ? ` · ${s.role}` : ""}</span>
      {mineCard ? (
        <button className="hd-joined" onClick={() => router.push(`/game/s/${s.id}`)}>Open</button>
      ) : (
        <button onClick={() => joinPublic(s.id)}>Join server</button>
      )}
    </article>
  );

  return (
    <AppShell active="hubs" hub="game">
      <HubWelcome
        eyebrow="Lobby open"
        lead="Ready when "
        accent="you are."
        body="Friends are online, your servers are waiting, and someone is always looking for one more player."
        action={<button className="hd-primary-action" onClick={() => router.push("/game/party")}><Icon name="plus" size={18} /> Create a party</button>}
      />

      <section className="hd-game-layout">
        <div className="hd-main-column">
          <article className="hd-feature-card hd-game-feature">
            <img src={GAME_IMG} alt="" />
            <div className="hd-game-glow" />
            <div className="hd-feature-overlay">
              <span className="hd-live-label"><span /> {lfg ? "Looking for players" : "Start something"}</span>
              <p className="hd-event-kicker">{lfg ? lfg.game : "Emerge community"}</p>
              <h3>{lfg ? lfg.title : "Find your squad tonight"}</h3>
              <p>{lfg ? `${lfg.players.length} of ${lfg.slots} spots filled · hosted by ${lfg.author.name}` : "Post what you're playing and let people join your party."}</p>
              <div className="hd-feature-actions">
                <button onClick={() => router.push("/game/party")}>{lfg ? "Join the party" : "Find a party"} <Icon name="arrow" size={17} /></button>
              </div>
            </div>
          </article>

          <div className="hd-section-heading">
            <div>
              <p className="hd-eyebrow">Find your people</p>
              <h3>Servers for you</h3>
            </div>
            <div className="hd-row-actions">
              <button className="hd-link-btn" onClick={() => setShowNew((v) => !v)}>New server <Icon name="plus" size={14} /></button>
              {found.length > 4 && <button className="hd-link-btn" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : "Discover all"} <Icon name="arrow" size={16} /></button>}
            </div>
          </div>
          {err && <p className="hd-err" role="alert" style={{ marginBottom: 10 }}>{err}</p>}

          {showNew && (
            <div className="hd-rail-card hd-inline-card">
              <div className="hd-form">
                <label className="hd-field">Server name<input className="hd-input" maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="hd-field">Description<input className="hd-input" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                <label className="hd-check"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Public (anyone can find and join)</label>
                <div className="hd-btn-row">
                  <button className="hd-btn hd-btn-solid" onClick={createServer} disabled={!form.name.trim()}>Create</button>
                  <button className="hd-btn" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {mine === null && <div className="ap-loading">Loading…</div>}
          {mine && mine.length === 0 && found.length === 0 && <Empty>No servers yet. Create one or join with an invite code below.</Empty>}
          <div className="hd-server-grid">
            {mine?.map((s) => card(s, true))}
            {shown.map((s) => card(s, false))}
          </div>

          <div className="hd-section-heading">
            <div>
              <p className="hd-eyebrow">Have an invite?</p>
              <h3>Join with a code</h3>
            </div>
          </div>
          <div className="hd-rail-card">
            <div className="hd-btn-row">
              <input className="hd-input" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && code.trim() && joinCode()} />
              <button className="hd-btn hd-btn-solid" style={{ flex: "0 0 auto", padding: "0 18px" }} onClick={joinCode} disabled={!code.trim()}>Join</button>
            </div>
          </div>
        </div>

        <aside className="hd-dashboard-rail">
          <div className="hd-rail-card hd-gaming-status">
            <div className="hd-status-top">
              <span className="hd-status-avatar">
                <HdAvatar name={session?.user?.name || "?"} src={session?.user?.avatarUrl} />
                <i />
              </span>
              <div>
                <p className="hd-eyebrow">Your status</p>
                <h3>{savedPlaying ? "Playing now" : "Online & ready"}</h3>
              </div>
            </div>
            <label>
              <span>Currently playing</span>
              <input placeholder="What are you playing?" maxLength={60} value={playing} onChange={(e) => setPlaying(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setStatus(playing)} />
            </label>
            <div className="hd-btn-row" style={{ marginTop: 10 }}>
              <button className="hd-btn hd-btn-solid" onClick={() => setStatus(playing)}>Set status</button>
              {savedPlaying && <button className="hd-btn" onClick={() => setStatus("")}>Clear</button>}
            </div>
          </div>

          <div className="hd-rail-card hd-party-card">
            <div className="hd-section-heading hd-compact">
              <div>
                <p className="hd-eyebrow">Friends online</p>
                <h3>Your party</h3>
              </div>
              {friends.length > 0 && <span className="hd-online-count">{friends.length} playing</span>}
            </div>
            {friends.length === 0 && <p className="hd-rail-note" style={{ marginTop: 0 }}>Nobody you follow is playing right now.</p>}
            {friends.map((f) => (
              <div className="hd-party-person" key={f.user.id}>
                <span>
                  <HdAvatar name={f.user.name} src={f.user.avatarUrl} />
                  <i />
                </span>
                <div>
                  <strong>{f.user.name}</strong>
                  <small>Playing {f.game}</small>
                </div>
              </div>
            ))}
            <button className="hd-invite-button" onClick={() => router.push("/game/party")}>
              Find a party <Icon name="arrow" size={16} />
            </button>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
