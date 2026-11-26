import Link from "next/link";
import Logo from "./Logo";

// Shared frame for the Privacy Policy and Terms. Text between [FILL IN: ...]
// markers is something only the business owner or a lawyer can supply.
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="ap-root" style={{ minHeight: "100vh", padding: "24px 16px 64px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", lineHeight: 1.65 }}>
        <Link href="/" aria-label="Emect home" style={{ textDecoration: "none", color: "inherit" }}><Logo width={150} /></Link>
        <p style={{ margin: "24px 0 0", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", fontSize: 14 }}>
          <strong>Draft for legal review.</strong> Parts marked [FILL IN] need business details. This is not legal advice.
        </p>
        <h1 style={{ fontFamily: "var(--font-display), system-ui, sans-serif", fontSize: 34, margin: "24px 0 4px" }}>{title}</h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, opacity: 0.75 }}>Last updated: {updated}</p>
        {children}
        <p style={{ marginTop: 40, fontSize: 14 }}><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms</Link> · <Link href="/">Home</Link></p>
      </div>
    </div>
  );
}
