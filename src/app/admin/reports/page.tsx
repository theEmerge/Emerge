"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type R = {
  id: string; targetType: string; targetId: string; reason: string; note: string | null;
  snapshot: string | null; createdAt: string; reporter: string;
  targetUser: { id: string; handle: string; name: string } | null;
};

// Team page: open reports, oldest first. Only emails listed in ADMIN_EMAILS get in.
export default function AdminReportsPage() {
  const [reports, setReports] = useState<R[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/reports");
    if (res.status === 401) { setError("Please log in first."); return; }
    if (res.status === 403) { setError("This page is for the team only."); return; }
    const data = await res.json();
    setReports(data.reports);
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, action: "dismiss" | "remove") {
    if (action === "remove" && !confirm("Remove this content for everyone?")) return;
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) load();
    else alert("Could not do that (" + res.status + ").");
  }

  return (
    <div className="ap-root" style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Open reports</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}><Link href="/">← Back to Emerge</Link> · check daily</p>
      {error && <p>{error}</p>}
      {!error && reports === null && <p>Loading…</p>}
      {reports && reports.length === 0 && <p>Nothing to review. 🎉</p>}
      {reports?.map((r) => (
        <div key={r.id} style={{ border: "1px solid rgba(128,128,128,.4)", padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>
            {r.targetType} · {r.reason.replace("_", " ")}
          </div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            reported by @{r.reporter} · {new Date(r.createdAt).toLocaleString()}
            {r.targetUser && <> · about <Link href={`/u/${r.targetUser.handle}`}>@{r.targetUser.handle}</Link></>}
          </div>
          {r.snapshot && <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0", fontFamily: "inherit" }}>{r.snapshot}</pre>}
          {r.note && <div style={{ fontSize: 14 }}>Reporter note: {r.note}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {r.targetType !== "USER" && <button className="ap-post-btn" onClick={() => act(r.id, "remove")}>Remove content</button>}
            <button className="ap-icon-btn" onClick={() => act(r.id, "dismiss")}>{r.targetType === "USER" ? "Done / dismiss" : "Dismiss"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
