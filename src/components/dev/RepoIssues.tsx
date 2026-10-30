"use client";
import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorLine, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";
import type { RepoProps } from "./RepoView";

type Issue = { number: number; title: string; status: string; col: string; createdAt: string; author: PersonLite; comments: number };
type Detail = {
  issue: { number: number; title: string; body: string | null; status: string; col: string; createdAt: string; author: PersonLite };
  comments: { id: string; body: string; createdAt: string; author: PersonLite }[];
  canWrite: boolean; canClose: boolean;
};
const COLS: [string, string][] = [["todo", "To do"], ["doing", "In progress"], ["done", "Done"]];

export default function RepoIssues({ base, reload }: RepoProps) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [view, setView] = useState<"open" | "closed" | "board">("open");
  const [open, setOpen] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", `${base}/issues`);
    if (r.ok) { setIssues(r.data.issues); setCanWrite(r.data.canWrite); }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(null);
    const r = await call("POST", `${base}/issues`, form);
    if (!r.ok) return setErr(errorText(r.data));
    setShow(false);
    setForm({ title: "", body: "" });
    await load();
    reload();
  }
  async function move(n: number, col: string) {
    const r = await call("PATCH", `${base}/issues/${n}`, { col });
    if (!r.ok) setErr(errorText(r.data));
    load();
    reload();
  }

  if (open !== null) return <IssueDetail base={base} number={open} onBack={() => { setOpen(null); load(); reload(); }} />;

  const shown = (issues || []).filter((i) => (view === "open" ? i.status === "OPEN" : i.status === "CLOSED"));
  const item = (i: Issue) => (
    <button key={i.number} className="hx-title-link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", fontWeight: 700, textAlign: "left" }} onClick={() => setOpen(i.number)}>#{i.number} {i.title}</button>
  );

  return (
    <div>
      <div className="hx-row between" style={{ marginBottom: 12 }}>
        <div className="hx-chips">
          {([["open", "Open"], ["closed", "Closed"], ["board", "Board"]] as const).map(([k, l]) => (
            <button key={k} className={"hx-chip" + (view === k ? " on" : "")} style={{ border: "none", cursor: "pointer" }} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <button className="hx-btn primary small" onClick={() => setShow((s) => !s)}>New issue</button>
      </div>
      {show && (
        <div className="hx-card hx-form">
          <input className="hx-input" placeholder="Title" maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="hx-textarea" placeholder="Describe the problem or idea" maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <ErrorLine text={err} />
          <div className="hx-row"><button className="hx-btn primary" disabled={!form.title.trim()} onClick={create}>Submit</button><button className="hx-btn" onClick={() => setShow(false)}>Cancel</button></div>
        </div>
      )}
      {!show && <ErrorLine text={err} />}
      {issues === null && <div className="ap-loading">Loading…</div>}

      {view === "board" ? (
        <div className="hx-board">
          {COLS.map(([col, label]) => (
            <div className="hx-col" key={col}>
              <h3>{label} · {(issues || []).filter((i) => i.col === col).length}</h3>
              {(issues || []).filter((i) => i.col === col).map((i) => (
                <div className="hx-ticket" key={i.number}>
                  {item(i)}
                  <div className="hx-muted">{i.author.name}</div>
                  {canWrite && (
                    <div className="hx-row" style={{ marginTop: 6 }}>
                      {COLS.filter(([c]) => c !== col).map(([c, l]) => <button key={c} className="hx-btn small" onClick={() => move(i.number, c)}>→ {l}</button>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          {issues && shown.length === 0 && <Empty>{view === "open" ? "No open issues." : "No closed issues."}</Empty>}
          {shown.length > 0 && (
            <div className="hx-card" style={{ padding: "0 16px" }}>
              {shown.map((i) => (
                <div className="hx-list-item" key={i.number}>
                  {item(i)}
                  <div className="hx-muted">{i.author.name} · {timeAgo(i.createdAt)}{i.comments ? ` · ${i.comments} comment${i.comments === 1 ? "" : "s"}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IssueDetail({ base, number, onBack }: { base: string; number: number; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await call("GET", `${base}/issues/${number}`);
    if (r.ok) setD(r.data);
  }, [base, number]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(status: string) {
    const r = await call("PATCH", `${base}/issues/${number}`, { status });
    if (!r.ok) return setErr(errorText(r.data));
    load();
  }
  async function post() {
    const r = await call("POST", `${base}/issues/${number}`, { body: comment });
    if (!r.ok) return setErr(errorText(r.data));
    setComment("");
    load();
  }
  if (!d) return <div className="ap-loading">Loading…</div>;
  const { issue } = d;

  return (
    <div>
      <button className="hx-btn small" onClick={onBack} style={{ marginBottom: 10 }}>Back to issues</button>
      <div className="hx-card">
        <div className="hx-row between"><h2 style={{ fontSize: 20 }}>#{issue.number} {issue.title}</h2><span className={"hx-status " + (issue.status === "OPEN" ? "open" : "closed")}>{issue.status.toLowerCase()}</span></div>
        <div className="hx-muted">{issue.author.name} · {timeAgo(issue.createdAt)}</div>
        {issue.body && <p className="hx-post-body">{issue.body}</p>}
        {d.canClose && <div style={{ marginTop: 10 }}><button className="hx-btn" onClick={() => setStatus(issue.status === "OPEN" ? "CLOSED" : "OPEN")}>{issue.status === "OPEN" ? "Close issue" : "Reopen issue"}</button></div>}
      </div>
      <ErrorLine text={err} />
      {d.comments.map((c) => (
        <div className="hx-card" key={c.id}>
          <b>{c.author.name}</b> <span className="hx-muted">{timeAgo(c.createdAt)}</span>
          <p className="hx-post-body">{c.body}</p>
        </div>
      ))}
      <div className="hx-form">
        <textarea className="hx-textarea" placeholder="Leave a comment" maxLength={3000} value={comment} onChange={(e) => setComment(e.target.value)} />
        <div><button className="hx-btn primary" disabled={!comment.trim()} onClick={post}>Comment</button></div>
      </div>
    </div>
  );
}
