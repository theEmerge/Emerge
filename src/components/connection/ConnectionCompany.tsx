"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { PageHead, Empty, ErrorLine, PersonRow, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";

type Detail = {
  slug: string; name: string; about: string | null; website: string | null; location: string | null;
  owner: PersonLite; isMine: boolean;
  jobs: { id: string; title: string; location: string | null; jobType: string; createdAt: string }[];
};

export default function ConnectionCompany({ slug }: { slug: string }) {
  const [c, setC] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ about: "", website: "", location: "" });
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await call("GET", `/api/connection/companies/${slug}`);
    if (!r.ok) return setMissing(true);
    setC(r.data.company);
    setForm({ about: r.data.company.about || "", website: r.data.company.website || "", location: r.data.company.location || "" });
  }
  useEffect(() => { load(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const r = await call("PATCH", `/api/connection/companies/${slug}`, form);
    if (!r.ok) return setErr(errorText(r.data));
    setEditing(false);
    load();
  }

  return (
    <AppShell active="hubs" hub="connection">
      <div className="hx-page">
        {missing && <Empty>That company page doesn't exist.</Empty>}
        {!missing && !c && <div className="ap-loading">Loading…</div>}
        {c && (
          <>
            <PageHead title={c.name} sub={[c.location, c.website].filter(Boolean).join(" · ")} action={c.isMine ? <button className="hx-btn" onClick={() => setEditing((e) => !e)}>Edit</button> : undefined} />
            {editing ? (
              <div className="hx-card hx-form">
                <label className="hx-label">About<textarea className="hx-textarea" maxLength={2000} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} /></label>
                <label className="hx-label">Website<input className="hx-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
                <label className="hx-label">Location<input className="hx-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
                <ErrorLine text={err} />
                <div><button className="hx-btn primary" onClick={save}>Save</button></div>
              </div>
            ) : (
              <div className="hx-card">
                <p className="hx-post-body" style={{ marginTop: 0 }}>{c.about || "No description yet."}</p>
                {c.website && <p><a href={c.website} target="_blank" rel="noopener noreferrer nofollow">{c.website}</a></p>}
                <PersonRow user={c.owner} href={`/connection/in/${c.owner.handle}`} sub="Page owner" />
              </div>
            )}
            <h2 className="hx-section">Open jobs</h2>
            {c.jobs.length === 0 && <Empty>No open jobs right now.</Empty>}
            {c.jobs.map((j) => (
              <div className="hx-card" key={j.id}>
                <b>{j.title}</b>
                <div className="hx-muted">{j.location ? `${j.location} · ` : ""}{j.jobType} · {timeAgo(j.createdAt)}</div>
              </div>
            ))}
            {c.jobs.length > 0 && <Link href="/connection/jobs" className="hx-btn">Open the job board</Link>}
          </>
        )}
      </div>
    </AppShell>
  );
}
