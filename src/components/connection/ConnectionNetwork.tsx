"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../AppShell";
import { PageHead, Empty, ErrorLine, PersonRow, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";

type Person = PersonLite & { proProfile: { headline: string | null } | null };
type Net = {
  connections: { id: string; user: Person }[];
  incoming: { id: string; user: Person }[];
  outgoing: { id: string; user: Person }[];
  suggestions: { user: Person; mutual: number }[];
};

export default function ConnectionNetwork() {
  const [net, setNet] = useState<Net | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", "/api/connection/network");
    if (r.ok) setNet(r.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, userId: string) {
    setErr(null);
    const r = await call("POST", "/api/connection/network", { action, userId });
    if (!r.ok) return setErr(errorText(r.data));
    await load();
    if (results) search();
  }

  async function search() {
    if (!q.trim()) return setResults(null);
    const r = await call("GET", `/api/connection/network?q=${encodeURIComponent(q.trim())}`);
    if (r.ok) setResults(r.data.people);
  }

  const known = new Set<string>([
    ...(net?.connections || []).map((c) => c.user.id),
    ...(net?.outgoing || []).map((c) => c.user.id),
    ...(net?.incoming || []).map((c) => c.user.id),
  ]);
  const link = (u: PersonLite) => `/connection/in/${u.handle}`;

  return (
    <AppShell active="hubs" hub="connection">
      <div className="hx-page">
        <PageHead title="My network" sub={net ? `${net.connections.length} connection${net.connections.length === 1 ? "" : "s"}` : undefined} />
        <ErrorLine text={err} />

        <div className="hx-card">
          <div className="hx-row">
            <input className="hx-input" style={{ flex: 1 }} placeholder="Find people by name or handle" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            <button className="hx-btn" onClick={search}>Search</button>
          </div>
          {results && (
            <div style={{ marginTop: 8 }}>
              {results.length === 0 && <p className="hx-muted">No one found.</p>}
              {results.map((p) => (
                <PersonRow key={p.id} user={p} href={link(p)} sub={p.proProfile?.headline}>
                  {!known.has(p.id) && <button className="hx-btn small primary" onClick={() => act("request", p.id)}>Connect</button>}
                </PersonRow>
              ))}
            </div>
          )}
        </div>

        {net === null && <div className="ap-loading">Loading…</div>}

        {!!net?.incoming.length && (
          <>
            <h2 className="hx-section">Requests</h2>
            <div className="hx-card">
              {net.incoming.map((r) => (
                <PersonRow key={r.id} user={r.user} href={link(r.user)} sub={r.user.proProfile?.headline}>
                  <button className="hx-btn small primary" onClick={() => act("accept", r.user.id)}>Accept</button>
                  <button className="hx-btn small" onClick={() => act("decline", r.user.id)}>Decline</button>
                </PersonRow>
              ))}
            </div>
          </>
        )}

        {!!net?.suggestions.length && (
          <>
            <h2 className="hx-section">People you may know</h2>
            <p className="hx-muted">Friends of your connections, listed alphabetically.</p>
            <div className="hx-card">
              {net.suggestions.map((s) => (
                <PersonRow key={s.user.id} user={s.user} href={link(s.user)} sub={`${s.mutual} mutual connection${s.mutual === 1 ? "" : "s"}${s.user.proProfile?.headline ? ` · ${s.user.proProfile.headline}` : ""}`}>
                  <button className="hx-btn small primary" onClick={() => act("request", s.user.id)}>Connect</button>
                </PersonRow>
              ))}
            </div>
          </>
        )}

        {!!net?.outgoing.length && (
          <>
            <h2 className="hx-section">Sent requests</h2>
            <div className="hx-card">
              {net.outgoing.map((r) => (
                <PersonRow key={r.id} user={r.user} href={link(r.user)} sub={r.user.proProfile?.headline}>
                  <button className="hx-btn small" onClick={() => act("remove", r.user.id)}>Withdraw</button>
                </PersonRow>
              ))}
            </div>
          </>
        )}

        <h2 className="hx-section">Connections</h2>
        {net && net.connections.length === 0 && <Empty>No connections yet. Search for people you know and send a request.</Empty>}
        {!!net?.connections.length && (
          <div className="hx-card">
            {net.connections.map((c) => (
              <PersonRow key={c.id} user={c.user} href={link(c.user)} sub={c.user.proProfile?.headline}>
                <button className="hx-btn small danger" onClick={() => confirm(`Remove ${c.user.name} from your connections?`) && act("remove", c.user.id)}>Remove</button>
              </PersonRow>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
