"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "../AppShell";
import Avatar from "../Avatar";
import { Empty, ErrorLine, PersonRow, PersonLite } from "../HubUI";
import { call, errorText, openDm } from "@/lib/hubClient";

type Exp = { id: string; kind: string; title: string; org: string; startYear: number; endYear: number | null; description: string | null };
type Data = {
  user: PersonLite & { bio: string | null };
  profile: { headline: string | null; about: string | null; location: string | null; skills: string[]; portfolioUrl: string | null; openToWork: boolean } | null;
  experiences: Exp[];
  endorsements: Record<string, { count: number; byMe: boolean }>;
  recommendations: { id: string; body: string; author: PersonLite }[];
  status: "self" | "none" | "connected" | "pending_out" | "pending_in";
  connectionCount: number;
  mutual: PersonLite[];
  mutualCount: number;
};

export default function ProProfileView({ handle }: { handle: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ headline: "", about: "", location: "", skills: "", portfolioUrl: "", openToWork: false });
  const [expForm, setExpForm] = useState<{ kind: string; title: string; org: string; startYear: string; endYear: string; description: string } | null>(null);
  const [rec, setRec] = useState("");

  const load = useCallback(async () => {
    const r = await call("GET", `/api/connection/profile?handle=${encodeURIComponent(handle)}`);
    if (!r.ok) return setMissing(true);
    setD(r.data);
    const p = r.data.profile;
    setForm({ headline: p?.headline || "", about: p?.about || "", location: p?.location || "", skills: (p?.skills || []).join(", "), portfolioUrl: p?.portfolioUrl || "", openToWork: !!p?.openToWork });
  }, [handle]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<{ ok: boolean; data: any }>) {
    setErr(null);
    const r = await fn();
    if (!r.ok) return setErr(errorText(r.data));
    await load();
  }

  const connectAction = (action: string) => run(() => call("POST", "/api/connection/network", { action, userId: d!.user.id }));
  const saveProfile = () =>
    run(async () => {
      const r = await call("PUT", "/api/connection/profile", { ...form, skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean) });
      if (r.ok) setEditing(false);
      return r;
    });
  const addExp = () =>
    run(async () => {
      const r = await call("POST", "/api/connection/experience", { ...expForm, endYear: expForm?.endYear || null });
      if (r.ok) setExpForm(null);
      return r;
    });
  const endorse = (skill: string) => run(() => call("POST", "/api/connection/endorse", { userId: d!.user.id, skill }));
  const writeRec = () =>
    run(async () => {
      const r = await call("POST", "/api/connection/recommendations", { userId: d!.user.id, body: rec });
      if (r.ok) setRec("");
      return r;
    });

  if (missing) return <AppShell active="hubs" hub="connection"><div className="hx-page"><Empty>That profile doesn't exist.</Empty></div></AppShell>;
  if (!d) return <AppShell active="hubs" hub="connection"><div className="hx-page"><div className="ap-loading">Loading…</div></div></AppShell>;

  const self = d.status === "self";
  const connected = d.status === "connected";
  const skills = d.profile?.skills || [];
  const work = d.experiences.filter((e) => e.kind === "work");
  const edu = d.experiences.filter((e) => e.kind === "education");
  const years = (e: Exp) => `${e.startYear} – ${e.endYear ?? "Present"}`;

  const expList = (list: Exp[]) =>
    list.map((e) => (
      <div className="hx-list-item" key={e.id}>
        <div className="hx-row between">
          <div><b>{e.title}</b><div className="hx-muted">{e.org} · {years(e)}</div></div>
          {self && <button className="hx-btn small danger" onClick={() => run(() => call("DELETE", `/api/connection/experience?id=${e.id}`))}>Remove</button>}
        </div>
        {e.description && <p className="hx-post-body">{e.description}</p>}
      </div>
    ));

  return (
    <AppShell active="hubs" hub="connection">
      <div className="hx-page">
        <div className="hx-card">
          <div className="hx-row" style={{ gap: 16, alignItems: "flex-start" }}>
            <Avatar name={d.user.name} src={d.user.avatarUrl} size={84} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 24 }}>{d.user.name}</h1>
              <div>{d.profile?.headline || <span className="hx-muted">No headline yet</span>}</div>
              <div className="hx-muted">
                {d.profile?.location ? `${d.profile.location} · ` : ""}{d.connectionCount} connection{d.connectionCount === 1 ? "" : "s"} · <Link href={`/u/${d.user.handle}`}>@{d.user.handle}</Link>
              </div>
              {d.profile?.openToWork && <span className="hx-chip on" style={{ marginTop: 6 }}>Open to work</span>}
            </div>
          </div>
          <div className="hx-row" style={{ marginTop: 12 }}>
            {self && <button className="hx-btn primary" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel" : "Edit profile"}</button>}
            {d.status === "none" && <button className="hx-btn primary" onClick={() => connectAction("request")}>Connect</button>}
            {d.status === "pending_out" && <button className="hx-btn" onClick={() => connectAction("remove")}>Pending · Withdraw</button>}
            {d.status === "pending_in" && (<><button className="hx-btn primary" onClick={() => connectAction("accept")}>Accept</button><button className="hx-btn" onClick={() => connectAction("decline")}>Decline</button></>)}
            {!self && <button className="hx-btn" onClick={async () => { const id = await openDm(d.user.id, "connection"); if (id) router.push(`/messages/${id}?hub=connection`); }}>Message</button>}
            {connected && <button className="hx-btn danger" onClick={() => confirm("Remove this connection?") && connectAction("remove")}>Remove</button>}
          </div>
          <ErrorLine text={err} />
        </div>

        {!self && d.mutualCount > 0 && (
          <div className="hx-card">
            <b>{d.mutualCount} mutual connection{d.mutualCount === 1 ? "" : "s"}</b>
            <p className="hx-muted" style={{ margin: "2px 0 0" }}>They can vouch for you if you ask them for an introduction.</p>
            {d.mutual.map((m) => <PersonRow key={m.id} user={m} href={`/connection/in/${m.handle}`} />)}
          </div>
        )}

        {editing && (
          <div className="hx-card hx-form">
            <label className="hx-label">Headline<input className="hx-input" maxLength={120} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></label>
            <label className="hx-label">Location<input className="hx-input" maxLength={80} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <label className="hx-label">About<textarea className="hx-textarea" maxLength={2000} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} /></label>
            <label className="hx-label">Skills (comma separated, up to 20)<input className="hx-input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></label>
            <label className="hx-label">Portfolio link<input className="hx-input" value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} /></label>
            <label className="hx-row" style={{ fontSize: 14 }}><input type="checkbox" checked={form.openToWork} onChange={(e) => setForm({ ...form, openToWork: e.target.checked })} /> Open to work</label>
            <div><button className="hx-btn primary" onClick={saveProfile}>Save</button></div>
          </div>
        )}

        {(d.profile?.about || d.profile?.portfolioUrl) && (
          <div className="hx-card">
            <h2>About</h2>
            {d.profile?.about && <p className="hx-post-body" style={{ marginTop: 0 }}>{d.profile.about}</p>}
            {d.profile?.portfolioUrl && <p><a href={d.profile.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow">{d.profile.portfolioUrl}</a></p>}
          </div>
        )}

        <div className="hx-card">
          <h2>Skills</h2>
          {skills.length === 0 && <p className="hx-muted">{self ? "Add skills with Edit profile." : "No skills listed."}</p>}
          <div className="hx-chips">
            {skills.map((s) => {
              const e = d.endorsements[s] || { count: 0, byMe: false };
              return (
                <span key={s} className={"hx-chip" + (e.byMe ? " on" : "")}>
                  {s}{e.count > 0 && ` · ${e.count}`}
                  {connected && <button className="hx-btn small" style={{ padding: "1px 8px" }} onClick={() => endorse(s)}>{e.byMe ? "Endorsed" : "Endorse"}</button>}
                </span>
              );
            })}
          </div>
        </div>

        <div className="hx-card">
          <div className="hx-row between"><h2>Experience</h2>{self && !expForm && <button className="hx-btn small" onClick={() => setExpForm({ kind: "work", title: "", org: "", startYear: "", endYear: "", description: "" })}>Add</button>}</div>
          {expForm && (
            <div className="hx-form" style={{ marginBottom: 12 }}>
              <select className="hx-select" value={expForm.kind} onChange={(e) => setExpForm({ ...expForm, kind: e.target.value })}><option value="work">Work</option><option value="education">Education</option></select>
              <input className="hx-input" placeholder={expForm.kind === "work" ? "Title" : "Degree or course"} maxLength={120} value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} />
              <input className="hx-input" placeholder={expForm.kind === "work" ? "Company" : "School"} maxLength={120} value={expForm.org} onChange={(e) => setExpForm({ ...expForm, org: e.target.value })} />
              <div className="hx-grid2">
                <input className="hx-input" placeholder="Start year" inputMode="numeric" value={expForm.startYear} onChange={(e) => setExpForm({ ...expForm, startYear: e.target.value })} />
                <input className="hx-input" placeholder="End year (blank = present)" inputMode="numeric" value={expForm.endYear} onChange={(e) => setExpForm({ ...expForm, endYear: e.target.value })} />
              </div>
              <textarea className="hx-textarea" placeholder="Description (optional)" maxLength={1000} value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
              <div className="hx-row"><button className="hx-btn primary" onClick={addExp}>Save</button><button className="hx-btn" onClick={() => setExpForm(null)}>Cancel</button></div>
            </div>
          )}
          {work.length === 0 && !expForm && <p className="hx-muted">No work experience listed.</p>}
          {expList(work)}
          {edu.length > 0 && (<><h2 style={{ marginTop: 16 }}>Education</h2>{expList(edu)}</>)}
        </div>

        <div className="hx-card">
          <h2>Recommendations</h2>
          {d.recommendations.length === 0 && <p className="hx-muted">No recommendations yet.</p>}
          {d.recommendations.map((r) => (
            <div className="hx-list-item" key={r.id}>
              <PersonRow user={r.author} href={`/connection/in/${r.author.handle}`}>
                {(self || r.author.id === session?.user?.id) && <button className="hx-btn small danger" onClick={() => run(() => call("DELETE", `/api/connection/recommendations?id=${r.id}`))}>{self ? "Hide" : "Delete"}</button>}
              </PersonRow>
              <p className="hx-post-body">{r.body}</p>
            </div>
          ))}
          {connected && (
            <div className="hx-form" style={{ marginTop: 10 }}>
              <textarea className="hx-textarea" placeholder={`Recommend ${d.user.name}…`} maxLength={1500} value={rec} onChange={(e) => setRec(e.target.value)} />
              <div><button className="hx-btn primary" disabled={!rec.trim()} onClick={writeRec}>Post recommendation</button></div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
