"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../AppShell";
import { PageHead, Empty, ErrorLine, PersonRow, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";

type Lfg = {
  id: string; game: string; title: string; platform: string | null; slots: number; createdAt: string;
  author: PersonLite; players: PersonLite[]; isMine: boolean; joined: boolean;
};

export default function GameParty() {
  const [posts, setPosts] = useState<Lfg[] | null>(null);
  const [game, setGame] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ game: "", title: "", platform: "", slots: 4 });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", `/api/game/lfg?game=${encodeURIComponent(game)}`);
    if (r.ok) setPosts(r.data.posts);
  }, [game]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(null);
    const r = await call("POST", "/api/game/lfg", form);
    if (!r.ok) return setErr(errorText(r.data));
    setShow(false);
    setForm({ game: "", title: "", platform: "", slots: 4 });
    load();
  }
  async function act(id: string, action: string) {
    setErr(null);
    const r = await call("POST", `/api/game/lfg/${id}`, { action });
    if (!r.ok) setErr(errorText(r.data));
    load();
  }

  return (
    <AppShell active="hubs" hub="game">
      <div className="hx-page">
        <PageHead title="Find a party" sub="Open groups looking for players, newest first." action={<button className="hx-btn primary" onClick={() => setShow((s) => !s)}>Start a party</button>} />
        {show && (
          <div className="hx-card hx-form">
            <label className="hx-label">Game<input className="hx-input" maxLength={60} value={form.game} onChange={(e) => setForm({ ...form, game: e.target.value })} /></label>
            <label className="hx-label">What are you looking for?<input className="hx-input" maxLength={120} placeholder="Chill ranked grind, mics optional" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <div className="hx-grid2">
              <label className="hx-label">Platform<input className="hx-input" maxLength={40} placeholder="PC, PS5, Switch…" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></label>
              <label className="hx-label">Party size (including you)<input className="hx-input" type="number" min={2} max={16} value={form.slots} onChange={(e) => setForm({ ...form, slots: Number(e.target.value) })} /></label>
            </div>
            <div className="hx-row"><button className="hx-btn primary" onClick={create}>Post</button><button className="hx-btn" onClick={() => setShow(false)}>Cancel</button></div>
          </div>
        )}
        <ErrorLine text={err} />
        <input className="hx-input" style={{ marginBottom: 12 }} placeholder="Filter by game" value={game} onChange={(e) => setGame(e.target.value)} />

        {posts === null && <div className="ap-loading">Loading…</div>}
        {posts?.length === 0 && <Empty>No open parties. Start one.</Empty>}
        {posts?.map((p) => {
          const filled = p.players.length + 1;
          const full = filled >= p.slots;
          return (
            <div className="hx-card" key={p.id}>
              <div className="hx-row between">
                <div>
                  <b>{p.game}</b> <span className="hx-chip">{filled}/{p.slots}</span>{p.platform && <span className="hx-chip" style={{ marginLeft: 6 }}>{p.platform}</span>}
                  <div>{p.title}</div>
                </div>
                <span className="hx-muted">{timeAgo(p.createdAt)}</span>
              </div>
              <PersonRow user={p.author} href={`/u/${p.author.handle}`} sub="Host">
                {p.isMine ? <button className="hx-btn small" onClick={() => act(p.id, "close")}>Close party</button>
                  : p.joined ? <button className="hx-btn small" onClick={() => act(p.id, "leave")}>Leave</button>
                  : <button className="hx-btn small primary" disabled={full} onClick={() => act(p.id, "join")}>{full ? "Full" : "Join"}</button>}
              </PersonRow>
              {p.players.length > 0 && <div className="hx-chips">{p.players.map((u) => <span className="hx-chip" key={u.id}>@{u.handle}</span>)}</div>}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
