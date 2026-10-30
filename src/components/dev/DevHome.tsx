"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "../AppShell";
import { Empty, PersonLite, HubWelcome } from "../HubUI";
import { Icon, type IconName } from "../hubdesign/parts";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";

export type RepoLite = {
  id: string; name: string; description: string | null; isPublic: boolean; pinned: boolean; updatedAt: string;
  owner?: PersonLite; openIssues: number; openPulls: number;
};

export function RepoCard({ r, owner }: { r: RepoLite; owner: string }) {
  return (
    <div className="hx-card">
      <div className="hx-row between">
        <Link href={`/developer/r/${owner}/${r.name}`} className="hx-title-link">{owner}/{r.name}</Link>
        <span className="hx-chip">{r.isPublic ? "Public" : "Private"}</span>
      </div>
      {r.description && <p className="hx-post-body">{r.description}</p>}
      <div className="hx-muted" style={{ marginTop: 6 }}>{r.openIssues} open issue{r.openIssues === 1 ? "" : "s"} · {r.openPulls} open pull request{r.openPulls === 1 ? "" : "s"} · updated {timeAgo(r.updatedAt)}</div>
    </div>
  );
}

type Overview = {
  repos: { id: string; name: string; isPublic: boolean; spark: number[]; openIssues: number; openPulls: number }[];
  pulse: { series: number[]; total: number };
  runway: { repo: string; percent: number; steps: { label: string; detail: string; state: "done" | "active" | "next" }[] } | null;
};

const RUNTIME_COLORS = ["mint", "violet", "amber"] as const;

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <>
      {values.map((v, i) => <i key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%`, opacity: v ? 1 : 0.35 }} />)}
    </>
  );
}

const TOOLS: { icon: IconName; label: string; go: string }[] = [
  { icon: "user", label: "My profile", go: "profile" },
  { icon: "explore", label: "Explore", go: "explore" },
  { icon: "send", label: "Messages", go: "/messages?hub=developer" },
  { icon: "bell", label: "Notifications", go: "/notifications?hub=developer" },
];

export default function DevHome() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  useEffect(() => {
    call("GET", "/api/hub/overview?hub=developer").then((r) => r.ok && setOverview(r.data));
  }, []);
  const [tab, setTab] = useState<"mine" | "explore">("mine");
  const [repos, setRepos] = useState<RepoLite[] | null>(null);
  const [q, setQ] = useState("");
  const { data: session } = useSession();
  const me = session?.user?.handle ?? null;
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", isPublic: true });
  const [err, setErr] = useState<string | null>(null);
  // Local time for the eyebrow; set after mount so server and client markup match.
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (tab === "mine" && !me) return;
    setRepos(null);
    const r = await call("GET", `/api/dev/repos?${tab === "mine" ? `owner=${me}&` : ""}q=${encodeURIComponent(q)}`);
    if (r.ok) setRepos(r.data.repos);
  }, [tab, me, q]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(null);
    const r = await call("POST", "/api/dev/repos", form);
    if (!r.ok) return setErr(errorText(r.data));
    router.push(`/developer/r/${r.data.repo.owner}/${r.data.repo.name}`);
  }

  const myHandle = session?.user?.handle ?? "";
  const toAllRepos = () => document.getElementById("all-repos")?.scrollIntoView({ behavior: "smooth" });
  const runTool = (go: string) => {
    if (go === "profile") router.push(`/developer/u/${myHandle}`);
    else if (go === "explore") { setTab("explore"); toAllRepos(); }
    else router.push(go);
  };
  const pulse = overview?.pulse.series ?? new Array(12).fill(0);
  const pulseMax = Math.max(1, ...pulse);

  return (
    <AppShell active="hubs" hub="developer">
      <HubWelcome
        eyebrow={`Systems online${clock ? ` · ${clock} local` : ""}`}
        lead="Your ideas, "
        accent="in motion."
        body="A living view of everything you are building - from first commit to real people using it."
        action={<button className="hd-primary-action" onClick={() => setShow((v) => !v)}><Icon name="plus" size={18} /> New repository</button>}
      />

      {show && (
        <div className="hd-rail-card hd-inline-card">
          <div className="hd-form">
            <label className="hd-field">Name<input className="hd-input" maxLength={60} placeholder="my-project" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="hd-field">Description<input className="hd-input" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label className="hd-check"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Public (anyone on Emerge can read it)</label>
            {err && <p className="hd-err" role="alert">{err}</p>}
            <div className="hd-btn-row">
              <button className="hd-btn hd-btn-solid" disabled={!form.name.trim()} onClick={create}>Create</button>
              <button className="hd-btn" onClick={() => setShow(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <section className="hd-dev-cockpit">
        <div className="hd-system-map" aria-label="Live system map">
          <span className="hd-orbit hd-orbit-one" />
          <span className="hd-orbit hd-orbit-two" />
          <span className="hd-map-core">
            <Icon name="code" size={25} />
            <i />
          </span>
          <span className="hd-map-node hd-node-web"><Icon name="branch" size={17} /><small>Repos</small></span>
          <span className="hd-map-node hd-node-data"><Icon name="link" size={17} /><small>Pulls</small></span>
          <span className="hd-map-node hd-node-api"><Icon name="explore" size={17} /><small>Issues</small></span>
          <span className="hd-map-signal hd-signal-one" />
          <span className="hd-map-signal hd-signal-two" />
        </div>
        <div className="hd-cockpit-copy">
          <span className="hd-dev-pill"><i /> {overview ? (overview.repos.length ? "Active workspace" : "Ready for your first repo") : "Loading"}</span>
          <h3>Build in flow, not in tabs.</h3>
          <p>Code, pull requests, issues and releases live together, right next to the rest of your Emerge life.</p>
          <div className="hd-cockpit-actions">
            <button onClick={toAllRepos}>Open repositories <Icon name="arrow" size={17} /></button>
            {overview && <span>{overview.pulse.total} commit{overview.pulse.total === 1 ? "" : "s"} in the last 12 days</span>}
          </div>
        </div>
      </section>

      <section className="hd-dev-layout">
        <div className="hd-main-column">
          <div className="hd-section-heading">
            <div>
              <p className="hd-eyebrow">Runtime overview</p>
              <h3>Your repositories</h3>
            </div>
            <button onClick={toAllRepos}>See all <Icon name="arrow" size={16} /></button>
          </div>
          {overview && overview.repos.length === 0 && <Empty>You don&apos;t have any repositories yet. Create your first one.</Empty>}
          <div className="hd-runtime-grid">
            {overview?.repos.map((r, i) => {
              const color = RUNTIME_COLORS[i % RUNTIME_COLORS.length];
              return (
                <article className="hd-runtime-card" key={r.id}>
                  <div className="hd-runtime-top">
                    <span className={`hd-runtime-symbol hd-${color}`}>{r.name.slice(0, 1).toUpperCase()}</span>
                    <span className={`hd-runtime-status hd-${color}`}><i /> {r.isPublic ? "Public" : "Private"}</span>
                  </div>
                  <strong><Link href={`/developer/r/${myHandle}/${r.name}`}>{r.name}</Link></strong>
                  <small>{myHandle}/{r.name}</small>
                  <div className="hd-signal-chart" aria-hidden="true"><Spark values={r.spark} /></div>
                  <div className="hd-runtime-foot">
                    <span>Issues <b>{r.openIssues}</b></span>
                    <span>Pull requests <b>{r.openPulls}</b></span>
                  </div>
                </article>
              );
            })}
          </div>

          {overview?.runway && (
            <>
              <div className="hd-section-heading hd-runway-heading">
                <div>
                  <p className="hd-eyebrow">Release runway</p>
                  <h3>{overview.runway.repo}</h3>
                </div>
                <span>{overview.runway.percent}% ready</span>
              </div>
              <div className="hd-launch-card">
                <div className="hd-launch-progress"><span style={{ width: `${overview.runway.percent}%` }} /></div>
                {overview.runway.steps.map((st, i) => (
                  <div className={`hd-launch-step hd-${st.state}`} key={st.label}>
                    <span>{st.state === "done" ? <Icon name="check" size={15} /> : i + 1}</span>
                    <div>
                      <strong>{st.label}</strong>
                      <small>{st.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div id="all-repos" className="hd-section-heading hd-runway-heading">
            <div>
              <p className="hd-eyebrow">Everything</p>
              <h3>All repositories</h3>
            </div>
          </div>
          <div className="hx-tabs">
            <button className={"hx-tab" + (tab === "mine" ? " on" : "")} onClick={() => setTab("mine")}>Yours</button>
            <button className={"hx-tab" + (tab === "explore" ? " on" : "")} onClick={() => setTab("explore")}>Explore</button>
          </div>
          <input className="hd-input" style={{ marginBottom: 12 }} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
          {repos === null && <div className="ap-loading">Loading…</div>}
          {repos?.length === 0 && <Empty>{tab === "mine" ? "You don't have any repositories yet." : "No repositories found."}</Empty>}
          {repos?.map((r) => <RepoCard key={r.id} r={r} owner={r.owner?.handle || me || ""} />)}
          <p className="hx-muted">Explore lists the most recently updated first, not the most popular.</p>
        </div>

        <aside className="hd-dashboard-rail">
          <div className="hd-rail-card hd-api-pulse">
            <div className="hd-section-heading hd-compact">
              <div>
                <p className="hd-eyebrow">Commit pulse</p>
                <h3>{overview ? `${overview.pulse.total} commits` : "…"}</h3>
              </div>
              <span>12 days</span>
            </div>
            <div className="hd-pulse-chart" aria-hidden="true">
              {pulse.map((v, i) => <i key={i} style={{ height: `${Math.max(6, (v / pulseMax) * 100)}%`, opacity: v ? 1 : 0.35 }} />)}
            </div>
            <div className="hd-pulse-legend">
              <span><i /> Your commits</span>
            </div>
          </div>

          <div className="hd-rail-card hd-toolbox-card">
            <p className="hd-eyebrow">Toolbox</p>
            <h3>Jump back in</h3>
            <div className="hd-tool-grid">
              {TOOLS.map((t) => (
                <button key={t.label} onClick={() => runTool(t.go)}>
                  <Icon name={t.icon} size={18} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
