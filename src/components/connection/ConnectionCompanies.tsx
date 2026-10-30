"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import { PageHead, Empty, ErrorLine } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";

type Company = { id: string; slug: string; name: string; about: string | null; location: string | null; openJobs: number; isMine: boolean };

export default function ConnectionCompanies() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Company[] | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", about: "", website: "", location: "" });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", `/api/connection/companies?q=${encodeURIComponent(q)}`);
    if (r.ok) setList(r.data.companies);
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(null);
    const r = await call("POST", "/api/connection/companies", form);
    if (!r.ok) return setErr(errorText(r.data));
    router.push(`/connection/companies/${r.data.company.slug}`);
  }

  return (
    <AppShell active="hubs" hub="connection">
      <div className="hx-page">
        <PageHead title="Companies" sub="Alphabetical. Pages can't be promoted." action={<button className="hx-btn primary" onClick={() => setShow((s) => !s)}>Create a page</button>} />
        {show && (
          <div className="hx-card">
            <div className="hx-form">
              <label className="hx-label">Company name<input className="hx-input" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="hx-label">About<textarea className="hx-textarea" maxLength={2000} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} /></label>
              <div className="hx-grid2">
                <label className="hx-label">Website<input className="hx-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
                <label className="hx-label">Location<input className="hx-input" maxLength={100} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
              </div>
              <ErrorLine text={err} />
              <div className="hx-row"><button className="hx-btn primary" onClick={create}>Create</button><button className="hx-btn" onClick={() => setShow(false)}>Cancel</button></div>
            </div>
          </div>
        )}
        <input className="hx-input" style={{ marginBottom: 12 }} placeholder="Search companies" value={q} onChange={(e) => setQ(e.target.value)} />
        {list === null && <div className="ap-loading">Loading…</div>}
        {list?.length === 0 && <Empty>No companies yet.</Empty>}
        {list?.map((c) => (
          <div className="hx-card" key={c.id}>
            <Link href={`/connection/companies/${c.slug}`} className="hx-title-link">{c.name}</Link>
            <div className="hx-muted">{c.location ? `${c.location} · ` : ""}{c.openJobs} open job{c.openJobs === 1 ? "" : "s"}{c.isMine ? " · Yours" : ""}</div>
            {c.about && <p className="hx-post-body">{c.about.length > 160 ? c.about.slice(0, 160) + "…" : c.about}</p>}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
