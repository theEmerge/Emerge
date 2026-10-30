"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

function Verify() {
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"working" | "ok" | "bad">("working");

  useEffect(() => {
    if (!token) { setState("bad"); return; }
    fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => setState(r.ok ? "ok" : "bad"))
      .catch(() => setState("bad"));
  }, [token]);

  return (
    <div className="ap-auth-card">
      <Logo width={200} className="ap-auth-logo" priority />
      {state === "working" && <p className="ap-auth-sub">Confirming your email…</p>}
      {state === "ok" && (
        <>
          <p className="ap-auth-sub">Email confirmed. You can post and message now.</p>
          <Link href="/" className="ap-post-btn ap-auth-submit" style={{ textAlign: "center" }}>Open Emerge</Link>
        </>
      )}
      {state === "bad" && (
        <>
          <div className="ap-auth-error">This link is invalid, expired or already used.</div>
          <div className="ap-auth-switch">Log in and tap “Resend email” in the banner to get a new one.</div>
          <Link href="/login" className="ap-post-btn ap-auth-submit" style={{ textAlign: "center" }}>Log in</Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="ap-root ap-auth-page">
      <div className="ig-auth-theme-toggle"><ThemeToggle variant="icon" /></div>
      <Suspense fallback={null}><Verify /></Suspense>
    </div>
  );
}
