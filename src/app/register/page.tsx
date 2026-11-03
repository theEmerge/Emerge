"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import PasswordInput from "@/components/PasswordInput";
import Logo from "@/components/Logo";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, handle, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const messages: Record<string, string> = {
        user_exists: "That email or handle is taken.",
        weak_password: "Choose a stronger password: at least 8 characters, and not a common one.",
        password_too_long: "That password is too long (72 bytes max).",
        invalid_email: "Enter a valid email address.",
        invalid_name: "Name must be 1 to 50 characters.",
        invalid_handle: "Handle must be 3 to 30 letters, numbers, dots or underscores (some names are reserved).",
        rate_limited: "Too many attempts. Wait a minute and try again.",
      };
      setError(messages[data.error as string] || "Something went wrong.");
      return;
    }
    router.push("/login?registered=1");
  }

  return (
    <div className="ap-root ap-auth-page">
      <div className="ig-auth-theme-toggle"><ThemeToggle variant="icon" /></div>
      <form onSubmit={handleSubmit} className="ap-auth-card">
        <Logo width={200} className="ap-auth-logo" priority />
        <p className="ap-auth-sub">Create an account</p>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Handle (no @)" value={handle} onChange={(e) => setHandle(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="ap-auth-error">{error}</div>}
        <button type="submit" className="ap-post-btn ap-auth-submit">Create account</button>
        <div className="ap-auth-switch">
          Already have one? <Link href="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
