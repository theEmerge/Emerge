"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Empty, ErrorLine, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";
import type { RepoProps } from "./RepoView";

type P = { number: number; title: string; status: string; baseBranch: string; headBranch: string; createdAt: string; author: PersonLite; comments: number };
type Row = { t: " " | "+" | "-" | "~"; s: string };
type Change = { path: string; status: string; rows: Row[]; note?: string };
type Detail = {
  pull: { number: number; title: string; body: string | null; status: string; baseBranch: string; headBranch: string; createdAt: string; author: PersonLite };
  comments: { id: string; body: string; createdAt: string; author: PersonLite }[];
  changes: Change[]; canWrite: boolean;
};

export default function RepoPulls({ meta, base, reload }: RepoProps) {
  const [list, setList] = useState<P[] | null>(null);
  const [filter, setFilter] = useState("OPEN");
  const [open, setOpen] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", base: "main", head: "" });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", `${base}/pulls?status=${filter}`);
    if (r.ok) setList(r.data.pulls);
  }, [base, filter]);
  useEffect(() => { setList(null); load(); }, [load]);

  async function create() {
    setErr(null);
    const r = await call("POST", `${base}/pulls`, form);
    if (!r.ok) return setErr(errorText(r.data));
    setShow(false);
    setForm({ title: "", body: "", base: "main", head: "" });
    await reload();
    await load();
    setOpen(r.data.number);
  }

  if (open !== null) return <PullDetail base={base} number={open} onBack={() => { setOpen(null); load(); reload(); }} />;

  return (
    <div>
      <div className="hx-row between" style={{ marginBottom: 12 }}>
        <div className="hx-chips">
          {["OPEN", "MERGED", "CLOSED", "ALL"].map((s) => <button key={s} className={"hx-chip" + (filter === s ? " on" : "")} style={{ border: "none", cursor: "pointer" }} onClick={() => setFilter(s)}>{s[0] + s.slice(1).toLowerCase()}</button>)}
        </div>
        {meta.canWrite && <button className="hx-btn primary small" onClick={() => setShow((s) => !s)}>New pull request</button>}
      </div>
      {show && (
        <div className="hx-card hx-form">
          <div className="hx-grid2">
            <label className="hx-label">Merge into (base)<select className="hx-select" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })}>{meta.branches.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label className="hx-label">From (head)<select className="hx-select" value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })}><option value="">Choose a branch</option>{meta.branches.filter((b) => b !== form.base).map((b) => <option key={b}>{b}</option>)}</select></label>
          </div>
          <input className="hx-input" placeholder="Title" maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="hx-textarea" placeholder="Describe the change" maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <ErrorLine text={err} />
          <div className="hx-row"><button className="hx-btn primary" disabled={!form.title.trim() || !form.head} onClick={create}>Open pull request</button><button className="hx-btn" onClick={() => setShow(false)}>Cancel</button></div>
        </div>
      )}
      {list === null && <div className="ap-loading">Loading…</div>}
      {list?.length === 0 && <Empty>No pull requests here.{meta.canWrite && meta.branches.length < 2 ? " Create a branch in the Code tab first." : ""}</Empty>}
      {list?.map((p) => (
        <div className="hx-card" key={p.number}>
          <div className="hx-row between">
            <button className="hx-title-link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", fontWeight: 700, textAlign: "left" }} onClick={() => setOpen(p.number)}>#{p.number} {p.title}</button>
            <span className={"hx-status " + p.status.toLowerCase()}>{p.status.toLowerCase()}</span>
          </div>
          <div className="hx-muted">{p.headBranch} → {p.baseBranch} · {p.author.name} · {timeAgo(p.createdAt)}{p.comments ? ` · ${p.comments} comment${p.comments === 1 ? "" : "s"}` : ""}</div>
        </div>
      ))}
    </div>
  );
}

function PullDetail({ base, number, onBack }: { base: string; number: number; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call("GET", `${base}/pulls/${number}`);
    if (r.ok) setD(r.data);
  }, [base, number]);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, body?: string) {
    setErr(null);
    const r = await call("POST", `${base}/pulls/${number}`, { action, body });
    if (!r.ok) return setErr(errorText(r.data));
    if (action === "comment") setComment("");
    load();
  }
  if (!d) return <div className="ap-loading">Loading…</div>;
  const { pull } = d;

  return (
    <div>
      <button className="hx-btn small" onClick={onBack} style={{ marginBottom: 10 }}>Back to pull requests</button>
      <div className="hx-card">
        <div className="hx-row between"><h2 style={{ fontSize: 20 }}>#{pull.number} {pull.title}</h2><span className={"hx-status " + pull.status.toLowerCase()}>{pull.status.toLowerCase()}</span></div>
        <div className="hx-muted"><Link href={`/developer/u/${pull.author.handle}`}>{pull.author.name}</Link> wants to merge <span className="hx-mono">{pull.headBranch}</span> into <span className="hx-mono">{pull.baseBranch}</span> · {timeAgo(pull.createdAt)}</div>
        {pull.body && <p className="hx-post-body">{pull.body}</p>}
        <ErrorLine text={err} />
        <div className="hx-row" style={{ marginTop: 10 }}>
          {pull.status === "OPEN" && d.canWrite && <button className="hx-btn primary" onClick={() => act("merge")}>Merge</button>}
          {pull.status === "OPEN" && <button className="hx-btn" onClick={() => act("close")}>Close</button>}
          {pull.status === "CLOSED" && d.canWrite && <button className="hx-btn" onClick={() => act("reopen")}>Reopen</button>}
        </div>
        {pull.status === "OPEN" && <p className="hx-muted" style={{ marginBottom: 0 }}>Merging copies the files changed on {pull.headBranch} onto {pull.baseBranch}. If both branches edited the same file, the {pull.headBranch} version wins.</p>}
      </div>

      {pull.status === "OPEN" && (
        <>
          <h2 className="hx-section">Files changed ({d.changes.length})</h2>
          {d.changes.length === 0 && <Empty>No differences between these branches.</Empty>}
          {d.changes.map((c) => (
            <div className="hx-diff" key={c.path}>
              <div className="hx-diff-file">{c.path} <span className="hx-muted">({c.status})</span></div>
              <div className="hx-diff-body">
                {c.rows.map((r, i) => (
                  <span key={i} className={"hx-diff-row " + (r.t === "+" ? "add" : r.t === "-" ? "del" : r.t === "~" ? "gap" : "")}>{r.t === "~" ? `… ${r.s}` : `${r.t} ${r.s}`}</span>
                ))}
                {c.note && <span className="hx-diff-row gap">{c.note}</span>}
              </div>
            </div>
          ))}
        </>
      )}

      <h2 className="hx-section">Review comments</h2>
      {d.comments.length === 0 && <p className="hx-muted">No comments yet.</p>}
      {d.comments.map((c) => (
        <div className="hx-card" key={c.id}>
          <b>{c.author.name}</b> <span className="hx-muted">{timeAgo(c.createdAt)}</span>
          <p className="hx-post-body">{c.body}</p>
        </div>
      ))}
      <div className="hx-form">
        <textarea className="hx-textarea" placeholder="Leave a review comment" maxLength={3000} value={comment} onChange={(e) => setComment(e.target.value)} />
        <div><button className="hx-btn primary" disabled={!comment.trim()} onClick={() => act("comment", comment)}>Comment</button></div>
      </div>
    </div>
  );
}
