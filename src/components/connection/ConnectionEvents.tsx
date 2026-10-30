"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { PageHead, Empty, ErrorLine, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";

type EventItem = {
  id: string; title: string; description: string; location: string | null; isOnline: boolean; link: string | null;
  startsAt: string; endsAt: string | null; host: PersonLite; goingCount: number; going: boolean; isMine: boolean;
};
type Scope = "upcoming" | "going" | "hosting";
const EMPTY = { title: "", description: "", location: "", isOnline: false, link: "", startsAt: "", endsAt: "" };

function when(e: EventItem) {
  const s = new Date(e.startsAt);
  const date = s.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function ConnectionEvents() {
  const [scope, setScope] = useState<Scope>("upcoming");
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await call("GET", `/api/connection/events?scope=${scope}`);
    if (r.ok) setEvents(r.data.events);
  }, [scope]);
  useEffect(() => { setEvents(null); load(); }, [load]);

  async function create() {
    if (busy) return;
    setErr(null);
    setBusy(true);
    const r = await call("POST", "/api/connection/events", {
      ...form,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
    });
    setBusy(false);
    if (!r.ok) return setErr(errorText(r.data));
    setForm(EMPTY);
    setShowForm(false);
    setScope("hosting");
    load();
  }
  async function rsvp(e: EventItem) {
    setErr(null);
    const r = await call("POST", `/api/connection/events/${e.id}`, { action: e.going ? "not_going" : "going" });
    if (!r.ok) return setErr(errorText(r.data));
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this event? Everyone who RSVP'd will lose it.")) return;
    await call("DELETE", `/api/connection/events/${id}`);
    load();
  }

  return (
    <AppShell active="hubs" hub="connection">
      <div className="hx-page">
        <PageHead
          title="Events"
          sub="Meetups, webinars and workshops from your network. Soonest first."
          action={<button className="hx-btn primary" onClick={() => setShowForm((s) => !s)}>Host an event</button>}
        />

        {showForm && (
          <div className="hx-card">
            <div className="hx-form">
              <label className="hx-label">Title<input className="hx-input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <div className="hx-grid2">
                <label className="hx-label">Starts<input className="hx-input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
                <label className="hx-label">Ends (optional)<input className="hx-input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
              </div>
              <label className="hx-row" style={{ gap: 8 }}>
                <input type="checkbox" checked={form.isOnline} onChange={(e) => setForm({ ...form, isOnline: e.target.checked })} /> This is an online event
              </label>
              {!form.isOnline && <label className="hx-label">Location<input className="hx-input" maxLength={120} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>}
              <label className="hx-label">{form.isOnline ? "Join link" : "Link (optional)"}<input className="hx-input" maxLength={300} placeholder="https://" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></label>
              <label className="hx-label">About<textarea className="hx-textarea" maxLength={3000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <ErrorLine text={err} />
              <div className="hx-row">
                <button className="hx-btn primary" disabled={busy} onClick={create}>{busy ? "Publishing…" : "Publish event"}</button>
                <button className="hx-btn" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="hx-tabs">
          {([["upcoming", "Upcoming"], ["going", "I'm going"], ["hosting", "Hosting"]] as [Scope, string][]).map(([k, label]) => (
            <button key={k} className={"hx-tab" + (scope === k ? " on" : "")} onClick={() => setScope(k)}>{label}</button>
          ))}
        </div>
        {!showForm && <ErrorLine text={err} />}

        {events === null && <div className="ap-loading">Loading…</div>}
        {events?.length === 0 && (
          <Empty>{scope === "going" ? "You haven't RSVP'd to anything yet." : scope === "hosting" ? "You're not hosting any events." : "No upcoming events. Host the first one."}</Empty>
        )}
        {events?.map((e) => {
          const d = new Date(e.startsAt);
          return (
            <div className="hx-card hub-event" key={e.id}>
              <div className="hub-event-date" aria-hidden="true">
                <span>{d.toLocaleDateString(undefined, { month: "short" })}</span>
                <b>{d.getDate()}</b>
              </div>
              <div className="hub-event-body">
                <b>{e.title}</b>
                <div className="hx-muted">{when(e)} · {e.isOnline ? "Online" : e.location}</div>
                <div className="hx-muted">
                  Hosted by <Link href={`/connection/in/${e.host.handle}`}>{e.host.name}</Link> · {e.goingCount} going
                </div>
                {e.description && <p className="hx-post-body">{e.description}</p>}
                <div className="hx-row" style={{ marginTop: 8 }}>
                  {!e.isMine && <button className={"hx-btn small" + (e.going ? "" : " primary")} onClick={() => rsvp(e)}>{e.going ? "Going ✓" : "I'm going"}</button>}
                  {e.link && e.going && <a className="hx-btn small" href={e.link} target="_blank" rel="noopener noreferrer">Open link</a>}
                  {e.isMine && <button className="hx-btn small" onClick={() => remove(e.id)}>Delete</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
