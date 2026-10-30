"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import { Empty, ErrorLine, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import RepoCode from "./RepoCode";
import RepoCommits from "./RepoCommits";
import RepoPulls from "./RepoPulls";
import RepoIssues from "./RepoIssues";
import RepoReleases from "./RepoReleases";

export type RepoMeta = {
  repo: { id: string; name: string; description: string | null; isPublic: boolean; pinned: boolean };
  owner: PersonLite; isOwner: boolean; canWrite: boolean; branches: string[]; collaborators: PersonLite[];
  counts: { openIssues: number; openPulls: number; releases: number };
};
export type RepoProps = { meta: RepoMeta; base: string; reload: () => void };
type Tab = "code" | "commits" | "pulls" | "issues" | "releases" | "settings";

export default function RepoView({ owner, name }: { owner: string; name: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("code");
  const base = `/api/dev/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  const load = useCallback(async () => {
    const r = await call("GET", base);
    if (!r.ok) return setMissing(true);
    setMeta(r.data);
  }, [base]);
  useEffect(() => { load(); }, [load]);

  if (missing) return <AppShell active="hubs" hub="developer"><div className="hx-page"><Empty>That repository doesn&apos;t exist or is private. <Link href="/developer">Back</Link></Empty></div></AppShell>;
  if (!meta) return <AppShell active="hubs" hub="developer"><div className="hx-page"><div className="ap-loading">Loading…</div></div></AppShell>;

  const props: RepoProps = { meta, base, reload: load };
  const tabs: [Tab, string][] = [
    ["code", "Code"], ["commits", "Commits"], ["pulls", `Pull requests${meta.counts.openPulls ? ` (${meta.counts.openPulls})` : ""}`],
    ["issues", `Issues${meta.counts.openIssues ? ` (${meta.counts.openIssues})` : ""}`], ["releases", "Releases"],
  ];
  if (meta.isOwner) tabs.push(["settings", "Settings"]);

  return (
    <AppShell active="hubs" hub="developer">
      <div className="hx-page wide">
        <div className="hx-head">
          <div>
            <h1 style={{ fontSize: 22 }}><Link href={`/developer/u/${owner}`} style={{ color: "inherit" }}>{owner}</Link> / {meta.repo.name} <span className="hx-chip" style={{ verticalAlign: "middle" }}>{meta.repo.isPublic ? "Public" : "Private"}</span></h1>
            {meta.repo.description && <p className="hx-muted">{meta.repo.description}</p>}
          </div>
        </div>
        <div className="hx-tabs">
          {tabs.map(([k, label]) => <button key={k} className={"hx-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{label}</button>)}
        </div>
        {tab === "code" && <RepoCode {...props} />}
        {tab === "commits" && <RepoCommits {...props} />}
        {tab === "pulls" && <RepoPulls {...props} />}
        {tab === "issues" && <RepoIssues {...props} />}
        {tab === "releases" && <RepoReleases {...props} />}
        {tab === "settings" && <Settings {...props} onDeleted={() => router.push("/developer")} />}
      </div>
    </AppShell>
  );
}

function Settings({ meta, base, reload, onDeleted }: RepoProps & { onDeleted: () => void }) {
  const [desc, setDesc] = useState(meta.repo.description || "");
  const [collab, setCollab] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setErr(null);
    const r = await call("PATCH", base, body);
    if (!r.ok) return setErr(errorText(r.data));
    reload();
  }
  async function del() {
    const r = await call("DELETE", `${base}?confirm=${encodeURIComponent(confirmName)}`);
    if (!r.ok) return setErr("Type the repository name exactly to delete it.");
    onDeleted();
  }

  return (
    <div>
      <ErrorLine text={err} />
      <div className="hx-card hx-form">
        <h2>General</h2>
        <label className="hx-label">Description<input className="hx-input" maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <div className="hx-row">
          <button className="hx-btn primary" onClick={() => patch({ description: desc })}>Save description</button>
          <button className="hx-btn" onClick={() => patch({ pinned: !meta.repo.pinned })}>{meta.repo.pinned ? "Unpin from profile" : "Pin to profile"}</button>
          <button className="hx-btn" onClick={() => patch({ isPublic: !meta.repo.isPublic })}>Make {meta.repo.isPublic ? "private" : "public"}</button>
        </div>
      </div>
      <div className="hx-card">
        <h2>Collaborators</h2>
        <p className="hx-muted" style={{ marginTop: 0 }}>Collaborators can edit files, create branches, open and merge pull requests, and publish releases.</p>
        {meta.collaborators.map((c) => (
          <div className="hx-row between" key={c.id} style={{ padding: "6px 0" }}>
            <span>{c.name} <span className="hx-muted">@{c.handle}</span></span>
            <button className="hx-btn small danger" onClick={() => patch({ removeCollaborator: c.id })}>Remove</button>
          </div>
        ))}
        <div className="hx-row" style={{ marginTop: 8 }}>
          <input className="hx-input" style={{ flex: 1 }} placeholder="@handle" value={collab} onChange={(e) => setCollab(e.target.value)} />
          <button className="hx-btn primary" disabled={!collab.trim()} onClick={() => { patch({ addCollaborator: collab }); setCollab(""); }}>Add</button>
        </div>
      </div>
      <div className="hx-card">
        <h2>Delete repository</h2>
        <p className="hx-muted" style={{ marginTop: 0 }}>This removes all files, commits, pull requests, issues and releases. Type <b>{meta.repo.name}</b> to confirm.</p>
        <div className="hx-row">
          <input className="hx-input" style={{ flex: 1 }} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          <button className="hx-btn danger" disabled={confirmName !== meta.repo.name} onClick={del}>Delete</button>
        </div>
      </div>
    </div>
  );
}
