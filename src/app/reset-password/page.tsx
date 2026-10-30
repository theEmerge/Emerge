"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import PasswordInput from "@/components/PasswordInput";
import Logo from "@/components/Logo";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) { setDone(true); return; }
    const data = await res.json().catch(() => ({}));
    setError(
      data.error === "invalid_or_expired"
        ? "This link is invalid, expired or already used. Request a new one."
        : "Something went wrong."
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ap-auth-card">
      <Logo width={200} className="ap-auth-logo" priority />
      <p className="ap-auth-sub">Choose a new password</p>
      {done ? (
        <>
          <div className="ap-auth-hint">Password changed. You can log in now.</div>
          <Link href="/login" className="ap-post-btn ap-auth-submit" style={{ textAlign: "center" }}>Log in</Link>
        </>
      ) : (
        <>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="ap-auth-error">{error}</div>}
          <button type="submit" className="ap-post-btn ap-auth-submit" disabled={!token}>Save new password</button>
          <div className="ap-auth-switch"><Link href="/forgot-password">Request a new link</Link></div>
        </>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="ap-root ap-auth-page">
      <div className="ig-auth-theme-toggle"><ThemeToggle variant="icon" /></div>
      <Suspense fallback={null}><ResetForm /></Suspense>
    </div>
  );
}
