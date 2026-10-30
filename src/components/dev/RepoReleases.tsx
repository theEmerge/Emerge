"use client";
import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorLine, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";
import type { RepoProps } from "./RepoView";

type Rel = { id: string; tag: string; title: string; notes: string | null; createdAt: string; author: PersonLite };

export default function RepoReleases({ base, reload }: RepoProps) {
  const [list, setList] = useState<Rel[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ tag: "", title: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", `${base}/releases`);
    if (r.ok) { setList(r.data.releases); setCanWrite(r.data.canWrite); }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(null);
    const r = await call("POST", `${base}/releases`, form);
    if (!r.ok) return setErr(r.data?.error === "bad_tag" ? "Use letters, numbers, dots, dashes or underscores, like v1.0.0." : r.data?.error === "tag_taken" ? "That tag already has a release." : errorText(r.data));
    setShow(false);
    setForm({ tag: "", title: "", notes: "" });
    await load();
    reload();
  }

  return (
    <div>
      {canWrite && <div className="hx-row" style={{ marginBottom: 12, justifyContent: "flex-end" }}><button className="hx-btn primary small" onClick={() => setShow((s) => !s)}>New release</button></div>}
      {show && (
        <div className="hx-card hx-form">
          <div className="hx-grid2">
            <input className="hx-input" placeholder="Tag, e.g. v1.0.0" maxLength={40} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
            <input className="hx-input" placeholder="Release title" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <textarea className="hx-textarea" placeholder="Release notes" maxLength={5000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <ErrorLine text={err} />
          <div className="hx-row"><button className="hx-btn primary" disabled={!form.tag.trim()} onClick={create}>Publish release</button><button className="hx-btn" onClick={() => setShow(false)}>Cancel</button></div>
        </div>
      )}
      {list === null && <div className="ap-loading">Loading…</div>}
      {list?.length === 0 && <Empty>No releases yet.</Empty>}
      {list?.map((r) => (
        <div className="hx-card" key={r.id}>
          <div className="hx-row between"><b>{r.title}</b><span className="hx-chip hx-mono">{r.tag}</span></div>
          <div className="hx-muted">{r.author.name} · {timeAgo(r.createdAt)}</div>
          {r.notes && <p className="hx-post-body">{r.notes}</p>}
        </div>
      ))}
    </div>
  );
}
