"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Download, Trash2 } from "lucide-react";

// Settings section: download everything we hold, or delete the account for good.
export default function AccountData() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirm }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      await signOut({ callbackUrl: "/" });
      return;
    }
    const data = await res?.json().catch(() => ({}));
    setError(
      data?.error === "wrong_password" ? "That password is not correct."
      : data?.error === "rate_limited" ? "Too many tries. Wait a minute."
      : data?.error === "missing_fields" ? "Enter your password and type DELETE."
      : "Something went wrong. Nothing was deleted."
    );
  }

  return (
    <>
      <h2 className="ig-settings-h2">Your data</h2>
      <p className="ig-page-sub">Download a copy of what we hold, or delete your account.</p>
      <div className="ig-settings-card">
        <a className="ig-settings-row" href="/api/account/export" download>
          <Download size={19} />
          <span>Download my data (JSON)</span>
        </a>
        <button className="ig-settings-row" style={{ color: "#d33" }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <Trash2 size={19} />
          <span>Delete my account</span>
        </button>
        {open && (
          <form onSubmit={remove} style={{ padding: 16, display: "grid", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              This permanently deletes your profile, posts, stories, comments and messages you sent. It cannot be undone. See the{" "}
              <Link href="/privacy">Privacy Policy</Link> for how backups are handled.
            </p>
            <input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <input placeholder="Type DELETE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <div className="ap-auth-error">{error}</div>}
            <button type="submit" className="ap-post-btn" disabled={busy || confirm !== "DELETE"}>
              {busy ? "Deleting…" : "Delete everything"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
