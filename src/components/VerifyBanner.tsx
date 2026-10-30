"use client";
import { useEffect, useState } from "react";

// Shown to logged-in users whose email isn't confirmed yet. They can browse,
// but posting and messaging are blocked on the server until they confirm.
export default function VerifyBanner() {
  const [verified, setVerified] = useState(true); // assume fine until we know
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/verify-email/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d && d.verified === false) setVerified(false); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (verified) return null;

  async function resend() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/verify-email/resend", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res) { setMsg("Couldn't send. Try again."); return; }
    const d = await res.json().catch(() => ({}));
    if (res.status === 429) {
      setMsg(d.error === "cooldown" ? `Wait ${d.retryAfter || 30}s before asking again.` : "Too many requests. Try again in a few minutes.");
    } else {
      setMsg(d.alreadyVerified ? "Already confirmed - refresh the page." : d.ok ? "New code sent. Check your inbox (and spam)." : "Couldn't send the email. Try again later.");
    }
  }

  return (
    <div className="ap-verify-banner" role="status">
      <span>Confirm your email to post and message. We sent you a 6-digit code.</span>
      <a href="/verify-otp" style={{ fontWeight: 700, textDecoration: "underline", color: "inherit" }}>Enter code</a>
      <button onClick={resend} disabled={busy}>{busy ? "Sending…" : "Resend code"}</button>
      {msg && <span className="ap-verify-msg">{msg}</span>}
    </div>
  );
}
