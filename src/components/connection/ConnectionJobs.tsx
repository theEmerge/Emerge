"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "../AppShell";
import { PageHead, Empty, ErrorLine, PersonRow, PersonLite } from "../HubUI";
import { call, errorText, openDm } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";

type Job = {
  id: string; title: string; companyName: string; company: { slug: string; name: string } | null;
  location: string | null; jobType: string; description: string; open: boolean; createdAt: string;
  poster: PersonLite; applied: boolean; applicantCount: number | null; isMine: boolean;
};
type Applicant = { id: string; note: string | null; createdAt: string; user: PersonLite & { proProfile: { headline: string | null } | null } };
type MyCompany = { id: string; name: string };
const TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"];

export default function ConnectionJobs() {
  const router = useRouter();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [applicants, setApplicants] = useState<Record<string, Applicant[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [companies, setCompanies] = useState<MyCompany[]>([]);
  const [form, setForm] = useState({ title: "", companyId: "", companyName: "", location: "", jobType: "Full-time", description: "" });

  const load = useCallback(async () => {
    const r = await call("GET", `/api/connection/jobs?${tab === "mine" ? "mine=1&" : ""}q=${encodeURIComponent(q)}`);
    if (r.ok) setJobs(r.data.jobs);
  }, [tab, q]);
  useEffect(() => { setJobs(null); load(); }, [load]);

  useEffect(() => {
    call("GET", "/api/connection/companies").then((r) => {
      if (r.ok) setCompanies(r.data.companies.filter((c: any) => c.isMine).map((c: any) => ({ id: c.id, name: c.name })));
    });
  }, []);

  async function apply(job: Job) {
    setErr(null);
    const r = await call("POST", `/api/connection/jobs/${job.id}`, { note });
    if (!r.ok) return setErr(errorText(r.data));
    setNote("");
    load();
  }
  async function toggleOpen(job: Job) {
    await call("PATCH", `/api/connection/jobs/${job.id}`, { open: !job.open });
    load();
  }
  async function showApplicants(id: string) {
    const r = await call("GET", `/api/connection/jobs/${id}`);
    if (r.ok) setApplicants((a) => ({ ...a, [id]: r.data.applications }));
  }
  async function message(userId: string) {
    const id = await openDm(userId, "connection");
    if (id) router.push(`/messages/${id}?hub=connection`);
  }
  async function create() {
    setErr(null);
    const r = await call("POST", "/api/connection/jobs", form);
    if (!r.ok) return setErr(errorText(r.data));
    setShowForm(false);
    setForm({ title: "", companyId: "", companyName: "", location: "", jobType: "Full-time", description: "" });
    setTab("mine");
  }

  return (
    <AppShell active="hubs" hub="connection">
      <div className="hx-page">
        <PageHead title="Jobs" sub="Newest first. Employers can't pay to rank higher." action={<button className="hx-btn primary" onClick={() => setShowForm((s) => !s)}>Post a job</button>} />

        {showForm && (
          <div className="hx-card">
            <div className="hx-form">
              <label className="hx-label">Job title<input className="hx-input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              {companies.length > 0 && (
                <label className="hx-label">Post as company page
                  <select className="hx-select" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
                    <option value="">Not a company page</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              {!form.companyId && <label className="hx-label">Company name<input className="hx-input" maxLength={120} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>}
              <div className="hx-grid2">
                <label className="hx-label">Location<input className="hx-input" maxLength={100} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
                <label className="hx-label">Type
                  <select className="hx-select" value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                </label>
              </div>
              <label className="hx-label">Description<textarea className="hx-textarea" maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <ErrorLine text={err} />
              <div className="hx-row"><button className="hx-btn primary" onClick={create}>Publish</button><button className="hx-btn" onClick={() => setShowForm(false)}>Cancel</button></div>
            </div>
          </div>
        )}

        <div className="hx-tabs">
          <button className={"hx-tab" + (tab === "browse" ? " on" : "")} onClick={() => setTab("browse")}>Browse</button>
          <button className={"hx-tab" + (tab === "mine" ? " on" : "")} onClick={() => setTab("mine")}>Posted by me</button>
        </div>
        <input className="hx-input" style={{ marginBottom: 12 }} placeholder="Search title, company or place" value={q} onChange={(e) => setQ(e.target.value)} />
        {!showForm && <ErrorLine text={err} />}

        {jobs === null && <div className="ap-loading">Loading…</div>}
        {jobs?.length === 0 && <Empty>{tab === "mine" ? "You haven't posted any jobs." : "No open jobs match."}</Empty>}
        {jobs?.map((j) => (
          <div className="hx-card" key={j.id}>
            <div className="hx-row between">
              <div>
                <b>{j.title}</b>
                <div className="hx-muted">
                  {j.company ? <Link href={`/connection/companies/${j.company.slug}`}>{j.companyName}</Link> : j.companyName}
                  {j.location ? ` · ${j.location}` : ""} · {j.jobType} · {timeAgo(j.createdAt)}
                  {!j.open && " · Closed"}
                </div>
              </div>
              <button className="hx-btn small" onClick={() => setOpen(open === j.id ? null : j.id)}>{open === j.id ? "Hide" : "View"}</button>
            </div>
            {open === j.id && (
              <div style={{ marginTop: 10 }}>
                <p className="hx-post-body">{j.description}</p>
                <div style={{ marginTop: 10 }}>
                  <PersonRow user={j.poster} href={`/connection/in/${j.poster.handle}`} sub="Posted by">
                    {!j.isMine && <button className="hx-btn small" onClick={() => message(j.poster.id)}>Message recruiter</button>}
                  </PersonRow>
                </div>
                {!j.isMine && j.open && (
                  j.applied ? <p className="hx-muted">You applied to this job.</p> : (
                    <div className="hx-form">
                      <textarea className="hx-textarea" placeholder="Add a note (optional)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                      <div><button className="hx-btn primary" onClick={() => apply(j)}>Apply</button></div>
                    </div>
                  )
                )}
                {j.isMine && (
                  <div className="hx-row" style={{ marginTop: 8 }}>
                    <button className="hx-btn small" onClick={() => showApplicants(j.id)}>Applicants ({j.applicantCount ?? 0})</button>
                    <button className="hx-btn small" onClick={() => toggleOpen(j)}>{j.open ? "Close job" : "Reopen"}</button>
                  </div>
                )}
                {applicants[j.id]?.length === 0 && <p className="hx-muted">No applicants yet.</p>}
                {applicants[j.id]?.map((a) => (
                  <div key={a.id}>
                    <PersonRow user={a.user} href={`/connection/in/${a.user.handle}`} sub={a.user.proProfile?.headline}>
                      <button className="hx-btn small" onClick={() => message(a.user.id)}>Message</button>
                    </PersonRow>
                    {a.note && <p className="hx-post-body hx-muted">{a.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
