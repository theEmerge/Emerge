import Link from "next/link";
import Logo from "@/components/Logo";

// Shown for any URL that does not exist. Next sends it with a real 404
// status, so search engines drop the URL instead of indexing an error page.
export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="ap-root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 16px", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <Logo width={160} />
        <h1 style={{ fontFamily: "var(--font-display), system-ui, sans-serif", fontSize: 32, margin: "28px 0 8px" }}>Page not found</h1>
        <p style={{ margin: "0 0 24px", lineHeight: 1.5 }}>That page doesn&apos;t exist, or it moved. Head back to the start.</p>
        <Link
          href="/"
          style={{ display: "inline-block", padding: "11px 22px", borderRadius: 999, background: "var(--text)", color: "var(--bg)", fontWeight: 700, textDecoration: "none" }}
        >
          Go to Emect
        </Link>
      </div>
    </main>
  );
}
