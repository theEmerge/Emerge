"use client";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import PasswordInput from "@/components/PasswordInput";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("registered")) setInfo("Account created. Log in to get your code.");
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Step 1: check password and email a code.
  async function sendCode(isResend = false) {
    setError("");
    setInfo("");
    setBusy(true);
    const res = await fetch("/api/login/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    setBusy(false);
    if (!res) { setError("Couldn't reach the server. Try again."); return; }
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) {
      setStep("code");
      setCooldown(d.cooldown || 30);
      setInfo(isResend ? "New code sent. Check your inbox (and spam)." : "We emailed you a 6-digit code.");
      setTimeout(() => codeRef.current?.focus(), 50);
      return;
    }
    if (d.error === "rate_limited") setError("Too many attempts. Please wait 10 minutes and try again.");
    else if (d.error === "send_failed") setError("Couldn't send the code email. Try again in a moment.");
    else setError("Invalid email or password.");
  }

  // Step 2: password + code together create the session.
  async function verify(value: string) {
    setError("");
    setInfo("");
    setBusy(true);
    const res = await signIn("credentials", { redirect: false, email, password, code: value });
    if (res?.error) {
      setBusy(false);
      setCode("");
      codeRef.current?.focus();
      if (res.error === "OTP_INVALID") setError("That code isn't right. Try again.");
      else if (res.error === "OTP_LOCKED") setError("Too many wrong tries. Request a new code below.");
      else if (res.error === "OTP_EXPIRED") setError("That code has expired. Request a new one below.");
      else if (res.error === "RATE_LIMITED") setError("Too many attempts. Please wait 10 minutes and try again.");
      else setError("Couldn't log you in. Go back and try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "password") sendCode();
    else if (code.length === 6 && !busy) verify(code);
  }

  function onCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(v);
    if (v.length === 6 && !busy) verify(v);
  }

  function back() {
    setStep("password");
    setCode("");
    setError("");
    setInfo("");
  }

  return (
    <div className="ap-root ap-auth-page">
      <div className="ig-auth-theme-toggle"><ThemeToggle variant="icon" /></div>
      <form onSubmit={onSubmit} className="ap-auth-card">
        <Logo width={200} className="ap-auth-logo" priority />
        {step === "password" ? (
          <>
            <p className="ap-auth-sub">Chronological. No algorithm. No ads.</p>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <div className="ap-auth-error">{error}</div>}
            {info && !error && <div className="ap-auth-sub">{info}</div>}
            <button type="submit" disabled={busy} className="ap-post-btn ap-auth-submit">{busy ? "Sending code…" : "Log in"}</button>
            <div className="ap-auth-switch">
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
            <div className="ap-auth-switch">
              No account? <Link href="/register">Register</Link>
            </div>
          </>
        ) : (
          <>
            <p className="ap-auth-sub">Enter the 6-digit code we sent to {email}</p>
            <input
              ref={codeRef}
              className="ap-otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="······"
              value={code}
              onChange={onCodeChange}
              maxLength={6}
              aria-label="6-digit login code"
            />
            {error && <div className="ap-auth-error">{error}</div>}
            {info && !error && <div className="ap-auth-sub">{info}</div>}
            <button type="submit" disabled={busy || code.length !== 6} className="ap-post-btn ap-auth-submit">{busy ? "Checking…" : "Verify and log in"}</button>
            <div className="ap-auth-switch">
              Didn&apos;t get it?{" "}
              <button type="button" className="ap-otp-resend" disabled={cooldown > 0 || busy} onClick={() => sendCode(true)}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
            <div className="ap-auth-switch">
              <button type="button" className="ap-otp-resend" onClick={back}>Use a different account</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
