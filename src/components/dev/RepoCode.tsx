"use client";
import { useCallback, useEffect, useState } from "react";
import { ErrorLine } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import type { RepoProps } from "./RepoView";

export default function RepoCode({ meta, base, reload }: RepoProps) {
  const [branch, setBranch] = useState(meta.branches.includes("main") ? "main" : meta.branches[0]);
  const [files, setFiles] = useState<string[] | null>(null);
  const [dir, setDir] = useState("");
  const [open, setOpen] = useState<{ path: string; content: string } | null>(null);
  const [editing, setEditing] = useState<{ path: string; content: string; isNew: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", `${base}/files?branch=${encodeURIComponent(branch)}`);
    if (r.ok) setFiles(r.data.files);
  }, [base, branch]);
  useEffect(() => { setFiles(null); setOpen(null); setEditing(null); setDir(""); load(); }, [load]);

  async function openFile(path: string) {
    setErr(null);
    const r = await call("GET", `${base}/files?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`);
    if (r.ok && r.data.file) setOpen(r.data.file);
  }

  async function commit() {
    if (!editing) return;
    setErr(null);
    const r = await call("PUT", `${base}/files`, { branch, path: editing.path, content: editing.content, message });
    if (!r.ok) return setErr(errorText(r.data));
    const p = editing.path;
    setEditing(null);
    setMessage("");
    await load();
    openFile(p);
  }
  async function remove(path: string) {
    if (!confirm(`Delete ${path} on ${branch}?`)) return;
    const r = await call("DELETE", `${base}/files?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`);
    if (!r.ok) return setErr(errorText(r.data));
    setOpen(null);
    load();
  }
  async function makeBranch() {
    setErr(null);
    const r = await call("POST", `${base}/branches`, { name: newBranch, from: branch });
    if (!r.ok) return setErr(errorText(r.data));
    setNewBranch("");
    await reload();
    setBranch(r.data.name);
  }

  // Build one directory level from the flat list of paths.
  const prefix = dir ? dir + "/" : "";
  const here = (files || []).filter((p) => p.startsWith(prefix));
  const folders = Array.from(new Set(here.filter((p) => p.slice(prefix.length).includes("/")).map((p) => p.slice(prefix.length).split("/")[0])));
  const direct = here.filter((p) => !p.slice(prefix.length).includes("/"));
  const readme = (files || []).includes("README.md") && !dir;

  return (
    <div>
      <div className="hx-row" style={{ marginBottom: 12 }}>
        <select className="hx-select" style={{ width: "auto" }} value={branch} onChange={(e) => setBranch(e.target.value)}>
          {meta.branches.map((b) => <option key={b}>{b}</option>)}
        </select>
        {meta.canWrite && (
          <>
            <input className="hx-input" style={{ width: 160 }} placeholder="new-branch-name" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
            <button className="hx-btn small" disabled={!newBranch.trim()} onClick={makeBranch}>Branch from {branch}</button>
            <button className="hx-btn small primary" onClick={() => setEditing({ path: prefix, content: "", isNew: true })}>Add file</button>
          </>
        )}
      </div>
      <ErrorLine text={err} />

      {editing ? (
        <div className="hx-card hx-form">
          <label className="hx-label">File path<input className="hx-input hx-mono" disabled={!editing.isNew} value={editing.path} onChange={(e) => setEditing({ ...editing, path: e.target.value })} /></label>
          <textarea className="hx-textarea hx-code" spellCheck={false} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
          <label className="hx-label">Commit message<input className="hx-input" maxLength={200} placeholder={editing.isNew ? `Add ${editing.path}` : `Update ${editing.path}`} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          <p className="hx-muted" style={{ margin: 0 }}>Committing to <b>{branch}</b></p>
          <div className="hx-row"><button className="hx-btn primary" onClick={commit}>Commit</button><button className="hx-btn" onClick={() => setEditing(null)}>Cancel</button></div>
        </div>
      ) : open ? (
        <div>
          <div className="hx-row between" style={{ marginBottom: 8 }}>
            <span className="hx-mono"><button className="hx-btn small" onClick={() => setOpen(null)}>Back</button> {open.path}</span>
            {meta.canWrite && (
              <span className="hx-row">
                <button className="hx-btn small" onClick={() => setEditing({ path: open.path, content: open.content, isNew: false })}>Edit</button>
                <button className="hx-btn small danger" onClick={() => remove(open.path)}>Delete</button>
              </span>
            )}
          </div>
          <pre className="hx-pre">{open.content || "(empty file)"}</pre>
        </div>
      ) : (
        <>
          <div className="hx-card hx-files" style={{ padding: 0, overflow: "hidden" }}>
            {dir && <button onClick={() => setDir(dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "")}>..</button>}
            {files === null && <div className="ap-loading">Loading…</div>}
            {folders.sort().map((f) => <button key={f} onClick={() => setDir(prefix + f)}>📁 {f}</button>)}
            {direct.sort().map((p) => <button key={p} onClick={() => openFile(p)}>📄 {p.slice(prefix.length)}</button>)}
            {files && files.length === 0 && <div className="hx-empty" style={{ border: "none" }}>This branch has no files.</div>}
          </div>
          {readme && <ReadmePreview base={base} branch={branch} />}
        </>
      )}
    </div>
  );
}

function ReadmePreview({ base, branch }: { base: string; branch: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    call("GET", `${base}/files?branch=${encodeURIComponent(branch)}&path=README.md`).then((r) => setText(r.ok ? r.data.file?.content ?? null : null));
  }, [base, branch]);
  if (!text) return null;
  return (
    <div className="hx-card">
      <h2>README.md</h2>
      <pre className="hx-post-body" style={{ margin: 0, fontFamily: "inherit" }}>{text}</pre>
    </div>
  );
}
