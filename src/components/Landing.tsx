import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { HUBS } from "@/lib/hubs";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import styles from "./Landing.module.css";

// Public front page for visitors who are not logged in. It is rendered on the
// server, so search engines get the full text and structured data in the first
// HTML response instead of a login form.

const BENEFITS = [
  { title: "Newest first, always", text: "Your Home feed lists posts in the order they were shared. Nothing is ranked, boosted or hidden by an algorithm." },
  { title: "No ads", text: "Emect is ad-free, so your feed is made of people and communities, not sponsored posts." },
  { title: "Topic communities", text: "Join communities built around a topic and follow their photos in a feed of their own." },
  { title: "Rolls, stories and messages", text: "Share a roll of photos, post stories and reels, and chat in direct messages and group chats." },
];

// Shown on the page AND sent as FAQ structured data, so the two never drift apart.
const FAQ = [
  { q: "What is Emect?", a: "Emect is a photo and community network that shows posts in the order they were shared. It has no ranking algorithm and no advertising." },
  { q: "Does Emect use an algorithm?", a: "No. Your Home feed shows posts from the people you follow and the communities you joined, newest first. Nothing is ranked or boosted." },
  { q: "Does Emect have ads?", a: "No. Emect is ad-free." },
  { q: "What are hubs?", a: "Hubs are separate spaces that share one Emect account: a Social Hub for photos and communities, a Professional Hub for careers and jobs, a Game Hub for gaming servers and parties, and a Developer Hub for repositories, pull requests and issues." },
  { q: "How do I create an account?", a: "Choose Create account, enter your name, email and a password, then confirm your email with the code we send you. After that you can post, message people and join communities." },
  { q: "Can I message other people on Emect?", a: "Yes. Emect has direct messages and group chats." },
];

function jsonLd() {
  const org = `${SITE_URL}/#organization`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": org, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon.png` },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, description: SITE_DESCRIPTION, publisher: { "@id": org } },
      { "@type": "WebApplication", name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION, applicationCategory: "SocialNetworkingApplication", operatingSystem: "Any" },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  // "<" is escaped so no text inside the data can close the script tag early.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function Landing() {
  return (
    <div className={`ap-root ${styles.page}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <Link href="/" aria-label="Emect home" style={{ textDecoration: "none", color: "inherit" }}>
            <Logo width={150} />
          </Link>
          <nav className={styles.nav} aria-label="Account">
            <span className={styles.toggle}><ThemeToggle variant="icon" /></span>
            <Link href="/login" className={`${styles.btn} ${styles.btnGhost}`}>Log in</Link>
            {/* Hidden on phones, where the same button sits right under the headline. */}
            <Link href="/register" className={`${styles.btn} ${styles.btnPrimary} ${styles.navCreate}`}>Create account</Link>
          </nav>
        </header>

        <main>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>Chronological. No algorithm. No ads.</p>
            <h1 className={styles.h1}>
              The chronological, <span className={styles.accent}>algorithm-free</span> photo network
            </h1>
            <p className={styles.lead}>
              Emect shows you the people and communities you follow in the order they posted. Share photos, join topic communities, and message friends without ads or a ranking feed in the way.
            </p>
            <div className={styles.ctaRow}>
              <Link href="/register" className={`${styles.btn} ${styles.btnPrimary}`}>Create your account</Link>
              <Link href="/login" className={`${styles.btn} ${styles.btnGhost}`}>Log in</Link>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="why">
            <h2 id="why" className={styles.h2}>Why people use Emect</h2>
            <p className={styles.sectionLead}>A social network that does what it says: it shows you what your people shared, newest first.</p>
            <div className={styles.grid}>
              {BENEFITS.map((b) => (
                <div className={styles.card} key={b.title}>
                  <h3 className={styles.h3}>{b.title}</h3>
                  <p>{b.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="hubs">
            <h2 id="hubs" className={styles.h2}>One account, four hubs</h2>
            <p className={styles.sectionLead}>Switch between spaces for friends, work, games and code without making a new profile.</p>
            <div className={styles.grid}>
              {HUBS.filter((h) => h.status === "live").map((h) => (
                <div className={styles.card} key={h.id}>
                  <h3 className={styles.h3}>{h.name}</h3>
                  <span className={styles.hubTag}>{h.tagline}</span>
                  <p>{h.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="faq">
            <h2 id="faq" className={styles.h2}>Frequently asked questions</h2>
            <div className={styles.faq}>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className={styles.closing} aria-labelledby="join">
            <h2 id="join" className={styles.h2}>See your people in order</h2>
            <Link href="/register" className={`${styles.btn} ${styles.btnPrimary}`}>Create your account</Link>
          </section>
        </main>

        <footer className={styles.footer}>
          <span>© 2026 {SITE_NAME}</span>
          <span>
            <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/login">Log in</Link> · <Link href="/register">Create account</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
