"use client";
import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setBusy(false);
    setSent(true); // same message whether or not the account exists
  }

  return (
    <div className="ap-root ap-auth-page">
      <div className="ig-auth-theme-toggle"><ThemeToggle variant="icon" /></div>
      <form onSubmit={handleSubmit} className="ap-auth-card">
        <Logo width={200} className="ap-auth-logo" priority />
        <p className="ap-auth-sub">Reset your password</p>
        {sent ? (
          <div className="ap-auth-hint">If that email has an account, we've sent a link. It expires in 30 minutes.</div>
        ) : (
          <>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className="ap-post-btn ap-auth-submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <div className="ap-auth-switch"><Link href="/login">Back to log in</Link></div>
      </form>
    </div>
  );
}
