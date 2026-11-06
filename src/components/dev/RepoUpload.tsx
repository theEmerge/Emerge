"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { call, errorText } from "@/lib/hubClient";

// Upload to a repo the way GitHub does it: drop files or whole folders anywhere on the Code tab (or pick
// them with a button), review the list, write a commit message, commit. Text files are stored as text;
// images and other binary files are stored as a marked base64 string and shown as a preview / download.

// Keep these in step with src/lib/dev.ts (the server enforces them too).
const MAX_FILE_CHARS = 1_000_000;
const MAX_BATCH_FILES = 100;
const MAX_BATCH_CHARS = 3_000_000;
const MAX_FILES_PER_BRANCH = 1_000;

export const BINARY_MARK = "emerge-binary:v1;";
export function parseBinary(content: string): { mime: string; base64: string; bytes: number } | null {
  if (!content.startsWith(BINARY_MARK)) return null;
  const rest = content.slice(BINARY_MARK.length);
  const i = rest.indexOf(";base64,");
  if (i < 0) return null;
  const base64 = rest.slice(i + 8);
  // the type is stored text, so only accept a plain "type/subtype"; anything odd becomes a generic download
  const claimed = rest.slice(0, i);
  const mime = /^[a-z0-9][a-z0-9.+-]{0,60}\/[a-z0-9][a-z0-9.+-]{0,60}$/i.test(claimed) ? claimed.toLowerCase() : "application/octet-stream";
  if (!/^[A-Za-z0-9+/=]*$/.test(base64)) return null; // not real base64: show it as text rather than build a link from it
  return { mime, base64, bytes: Math.floor((base64.length * 3) / 4) };
}

export type Staged = { path: string; size: number; content: string; binary: boolean };
export type Skipped = { path: string; why: string };

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", ".vercel", ".netlify", "__pycache__", ".idea"]);
const SKIP_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon", avif: "image/avif", bmp: "image/bmp",
  pdf: "application/pdf", zip: "application/zip", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp3: "audio/mpeg", mp4: "video/mp4",
};

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function cleanRel(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "").replace(/\/{2,}/g, "/");
}

function pathProblem(path: string): string | null {
  if (!path) return "empty name";
  if (path.length > 200) return "path is longer than 200 characters";
  const segs = path.split("/");
  if (segs.some((s) => !s || s === "." || s === "..")) return "invalid path";
  return null;
}

// Reads one dropped / chosen file. Returns the staged entry, or a reason it was skipped.
async function readOne(path: string, file: File): Promise<Staged | Skipped> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const head = bytes.subarray(0, Math.min(bytes.length, 8000));
  let isBinary = false;
  for (let i = 0; i < head.length; i++) if (head[i] === 0) { isBinary = true; break; }
  if (!isBinary) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.length > MAX_FILE_CHARS) return { path, why: `too large (${fmtBytes(file.size)}; text files can be about 1 MB)` };
      return { path, size: file.size, content: text, binary: false };
    } catch {
      isBinary = true; // not valid UTF-8, so treat it as binary
    }
  }
  const ext = (path.split(".").pop() || "").toLowerCase();
  const mime = file.type || MIME_BY_EXT[ext] || "application/octet-stream";
  const b64 = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(";base64,")[1] || "");
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(new Blob([buf], { type: mime }));
  });
  const content = `${BINARY_MARK}${mime};base64,${b64}`;
  if (content.length > MAX_FILE_CHARS) return { path, why: `too large (${fmtBytes(file.size)}; images and binary files can be about 750 KB)` };
  return { path, size: file.size, content, binary: true };
}

type Raw = { rel: string; file: File };

// Walk a dropped folder (FileSystemEntry) and collect every file with its relative path.
function walkEntry(entry: any, out: Raw[]): Promise<void> {
  return new Promise((resolve) => {
    if (!entry) return resolve();
    if (entry.isFile) {
      entry.file((f: File) => { out.push({ rel: cleanRel(entry.fullPath || f.name), file: f }); resolve(); }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all: any[] = [];
      const readBatch = () =>
        reader.readEntries(
          async (batch: any[]) => {
            if (!batch.length) {
              for (const e of all) await walkEntry(e, out);
              return resolve();
            }
            all.push(...batch);
            readBatch(); // readEntries returns results in chunks until it hands back an empty list
          },
          () => resolve(),
        );
      readBatch();
    } else resolve();
  });
}

export function useRepoUpload(opts: { base: string; branch: string; dir: string; existing: Set<string>; enabled: boolean; onCommitted: () => void | Promise<void> }) {
  const { base, branch, dir, existing, enabled, onCommitted } = opts;
  const [staged, setStaged] = useState<Staged[]>([]);
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const depth = useRef(0);
  const dirRef = useRef(dir);
  dirRef.current = dir;

  const addRaw = useCallback(async (raws: Raw[]) => {
    if (!raws.length) return;
    setReading(true);
    setError(null);
    setDone(null);
    const prefix = dirRef.current ? dirRef.current + "/" : "";
    const nextStaged: Staged[] = [];
    const nextSkipped: Skipped[] = [];
    for (const { rel, file } of raws) {
      const path = prefix + cleanRel(rel);
      const segs = path.split("/");
      const name = segs[segs.length - 1];
      if (segs.some((s) => SKIP_DIRS.has(s))) { nextSkipped.push({ path, why: "build / dependency folder" }); continue; }
      if (SKIP_FILES.has(name)) continue; // system junk, not worth mentioning
      if (/^\.env(\.|$)/i.test(name) && !/\.(example|sample|template)$/i.test(name)) { nextSkipped.push({ path, why: "looks like a secrets file (.env). Rename it if you really want it in the repo" }); continue; }
      const problem = pathProblem(path);
      if (problem) { nextSkipped.push({ path, why: problem }); continue; }
      try {
        const r = await readOne(path, file);
        if ("why" in r) nextSkipped.push(r); else nextStaged.push(r);
      } catch {
        nextSkipped.push({ path, why: "couldn't be read" });
      }
    }
    setStaged((prev) => {
      const map = new Map(prev.map((s) => [s.path, s]));
      nextStaged.forEach((s) => map.set(s.path, s)); // dropping the same path again replaces it
      return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
    });
    setSkipped((prev) => [...prev, ...nextSkipped]);
    setReading(false);
  }, []);

  // From the "Upload files" / "Upload folder" inputs
  const addFileList = useCallback((list: FileList | null) => {
    if (!list || !list.length) return;
    const raws: Raw[] = Array.from(list).map((f) => ({ rel: (f as any).webkitRelativePath || f.name, file: f }));
    void addRaw(raws);
  }, [addRaw]);

  // Whole-page drag and drop (only for drags that carry files, and only when this person may write)
  useEffect(() => {
    if (!enabled) return;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setDragging(true); };
    const over = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      // The DataTransfer is only valid inside this handler, so grab every entry / file NOW, then read them.
      const items = Array.from(e.dataTransfer?.items || []);
      const entries: any[] = [];
      const loose: File[] = [];
      for (const it of items) {
        if (it.kind !== "file") continue;
        const entry = (it as any).webkitGetAsEntry?.();
        if (entry) entries.push(entry);
        else { const f = it.getAsFile(); if (f) loose.push(f); }
      }
      if (!items.length) loose.push(...Array.from(e.dataTransfer?.files || []));
      void (async () => {
        const raws: Raw[] = loose.map((f) => ({ rel: f.name, file: f }));
        for (const en of entries) await walkEntry(en, raws);
        await addRaw(raws);
      })();
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [enabled, addRaw]);

  function remove(path: string) { setStaged((prev) => prev.filter((s) => s.path !== path)); }
  function clear() { setStaged([]); setSkipped([]); setMessage(""); setError(null); }

  const defaultMessage =
    staged.length === 1 ? `${existing.has(staged[0].path) ? "Update" : "Add"} ${staged[0].path}` : `Upload ${staged.length} files`;

  async function commit() {
    if (!staged.length || busy) return;
    const newCount = staged.filter((s) => !existing.has(s.path)).length;
    if (existing.size + newCount > MAX_FILES_PER_BRANCH) return setError(errorText({ error: "too_many_files" }));
    // split into batches the server accepts; each batch is its own commit
    const batches: Staged[][] = [];
    let cur: Staged[] = [];
    let chars = 0;
    for (const s of staged) {
      if (cur.length && (cur.length >= MAX_BATCH_FILES || chars + s.content.length > MAX_BATCH_CHARS)) { batches.push(cur); cur = []; chars = 0; }
      cur.push(s);
      chars += s.content.length;
    }
    if (cur.length) batches.push(cur);

    setError(null);
    let added = 0, updated = 0, unchanged = 0;
    const base_msg = message.trim() || defaultMessage;
    for (let i = 0; i < batches.length; i++) {
      setBusy(batches.length > 1 ? `Committing ${i + 1} of ${batches.length}…` : "Committing…");
      const r = await call("POST", `${base}/files`, {
        branch,
        message: batches.length > 1 ? `${base_msg} (${i + 1}/${batches.length})` : base_msg,
        files: batches[i].map((s) => ({ path: s.path, content: s.content })),
      });
      if (!r.ok && r.data?.error !== "no_changes") {
        setBusy(null);
        setError((batches.length > 1 && i > 0 ? `Committed ${i} of ${batches.length} parts, then stopped: ` : "") + errorText(r.data));
        if (i > 0) await onCommitted();
        return;
      }
      if (r.ok) { added += r.data.added || 0; updated += r.data.updated || 0; unchanged += r.data.unchanged || 0; }
      else unchanged += batches[i].length;
    }
    setBusy(null);
    const parts = [added && `${added} added`, updated && `${updated} updated`, unchanged && `${unchanged} unchanged`].filter(Boolean).join(", ");
    setDone(`Committed to ${branch}: ${parts || "no changes"}.`);
    setStaged([]);
    setSkipped([]);
    setMessage("");
    await onCommitted();
  }

  return { staged, skipped, dragging, reading, message, setMessage, defaultMessage, busy, error, done, setDone, addFileList, remove, clear, commit };
}

export type RepoUpload = ReturnType<typeof useRepoUpload>;

// "Upload files" / "Upload folder" buttons for the toolbar
export function UploadButtons({ up }: { up: RepoUpload }) {
  const dirProps = { webkitdirectory: "", directory: "" } as Record<string, string>;
  return (
    <>
      <label className="hx-btn small ru-pick">
        Upload files
        <input type="file" multiple hidden onChange={(e) => { up.addFileList(e.target.files); e.target.value = ""; }} />
      </label>
      <label className="hx-btn small ru-pick">
        Upload folder
        <input type="file" multiple hidden {...dirProps} onChange={(e) => { up.addFileList(e.target.files); e.target.value = ""; }} />
      </label>
    </>
  );
}

// Full-screen "drop here" layer while files are being dragged over the page
export function DropOverlay({ up, branch, dir }: { up: RepoUpload; branch: string; dir: string }) {
  if (!up.dragging) return null;
  return (
    <div className="ru-overlay" aria-hidden="true">
      <div className="ru-overlay-box">
        <div className="ru-overlay-icon">⬆</div>
        <strong>Drop files or folders to add them</strong>
        <span>to {dir ? `${dir}/` : "the top of the repository"} on <b>{branch}</b></span>
      </div>
    </div>
  );
}

// The review-and-commit card
export function UploadPanel({ up, branch, existing }: { up: RepoUpload; branch: string; existing: Set<string> }) {
  const { staged, skipped } = up;
  if (!staged.length && !skipped.length && !up.reading && !up.done) return null;
  const totalSize = staged.reduce((n, s) => n + s.size, 0);
  const updates = staged.filter((s) => existing.has(s.path)).length;
  return (
    <div className="hx-card ru-panel">
      {up.done && !staged.length && <div className="ru-done">✓ {up.done}<button className="hx-btn small" onClick={() => up.setDone(null)}>Dismiss</button></div>}
      {up.reading && <p className="hx-muted" style={{ margin: 0 }}>Reading files…</p>}
      {staged.length > 0 && (
        <>
          <div className="hx-row between">
            <h2 style={{ margin: 0 }}>{staged.length} {staged.length === 1 ? "file" : "files"} ready <span className="hx-muted">· {fmtBytes(totalSize)}{updates ? ` · ${updates} will replace existing` : ""}</span></h2>
            <button className="hx-btn small" onClick={up.clear} disabled={!!up.busy}>Cancel</button>
          </div>
          <ul className="ru-list">
            {staged.map((s) => (
              <li key={s.path}>
                <span className="ru-name hx-mono" title={s.path}>{s.binary ? "🖼 " : "📄 "}{s.path}</span>
                <span className={"ru-badge" + (existing.has(s.path) ? " upd" : " new")}>{existing.has(s.path) ? "update" : "new"}</span>
                <span className="ru-size">{fmtBytes(s.size)}</span>
                <button className="ru-x" onClick={() => up.remove(s.path)} disabled={!!up.busy} aria-label={`Remove ${s.path}`}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {skipped.length > 0 && (
        <details className="ru-skipped" open={staged.length === 0}>
          <summary>{skipped.length} skipped</summary>
          <ul>{skipped.slice(0, 50).map((s, i) => <li key={i}><span className="hx-mono">{s.path}</span> · {s.why}</li>)}{skipped.length > 50 && <li>…and {skipped.length - 50} more</li>}</ul>
        </details>
      )}
      {staged.length > 0 && (
        <div className="hx-form" style={{ marginTop: 4 }}>
          <label className="hx-label">Commit message
            <input className="hx-input" maxLength={200} placeholder={up.defaultMessage} value={up.message} onChange={(e) => up.setMessage(e.target.value)} disabled={!!up.busy} />
          </label>
          <p className="hx-muted" style={{ margin: 0 }}>Committing directly to <b>{branch}</b></p>
          {up.error && <p className="hx-err" style={{ margin: 0 }}>{up.error}</p>}
          <div className="hx-row">
            <button className="hx-btn primary" onClick={up.commit} disabled={!!up.busy || up.reading}>{up.busy || "Commit changes"}</button>
          </div>
        </div>
      )}
      {!staged.length && up.error && <p className="hx-err" style={{ margin: 0 }}>{up.error}</p>}
    </div>
  );
}
