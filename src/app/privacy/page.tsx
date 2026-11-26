import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Emect collects, why, who it is shared with, how long we keep it and how to use your rights.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const h2 = { fontSize: 22, margin: "32px 0 8px" } as const;

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="[FILL IN: date]">
      <p>This explains what Emect does with your information, in plain language. Emect is run by [FILL IN: legal name of the person or company, and address]. Contact: [FILL IN: privacy email, e.g. a monitored address].</p>

      <h2 style={h2}>1. What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, handle, email address and a password (stored only as a one-way hash, never in readable form). We confirm at sign-up that you are 18 or over; we do not keep your date of birth, only the date you accepted these terms.</li>
        <li><strong>What you share:</strong> profile photo, banner and bio; posts, rolls, stories, reels, comments, likes, saved posts; messages you send in direct and group chats; and, if you use the other hubs, professional profile, jobs, events, gaming server and developer repository content.</li>
        <li><strong>Technical data:</strong> your IP address is used briefly to limit abuse (rate limiting) and is held by our rate-limit service; our hosting provider keeps standard server logs. [FILL IN: confirm log retention with Netlify settings.]</li>
        <li><strong>Reports:</strong> if someone reports your content, we keep a copy of the reported text while we review it.</li>
      </ul>
      <p>We do not use advertising, analytics or tracking tools, and we do not record your screen or keystrokes. [FILL IN: update this if you add analytics.]</p>

      <h2 style={h2}>2. Why we use it</h2>
      <ul>
        <li>To create and run your account, show your content to the people you choose, and deliver messages. [FILL IN: legal basis, e.g. contract and consent. Ask a lawyer.]</li>
        <li>To send you sign-in codes, verification and password-reset emails. We do not send marketing email.</li>
        <li>To keep Emect safe: stop spam and break-ins, and review reports.</li>
      </ul>

      <h2 style={h2}>3. Who we share it with</h2>
      <p>We do not sell your data. These services process data for us:</p>
      <ul>
        <li><strong>Netlify</strong> (hosting and delivery of the website).</li>
        <li><strong>[FILL IN: database host]</strong> (the database holding your account and content).</li>
        <li><strong>Cloudinary</strong> (stores images and videos you upload; files are reachable by link).</li>
        <li><strong>Upstash</strong> (rate limiting, which sees IP addresses).</li>
        <li><strong>Google Gmail</strong> (sends our emails to your address).</li>
        <li><strong>Giphy</strong> (only when you open the GIF picker; your search words and IP address go to Giphy).</li>
      </ul>
      <p>Anything you post publicly can be seen by other people. [FILL IN: country where these providers store data, and the legal basis for transfers. Ask a lawyer.]</p>

      <h2 style={h2}>4. How long we keep it</h2>
      <ul>
        <li>Your account and content: until you delete them or your account.</li>
        <li>Stories: removed from view after 24 hours. [FILL IN: do you delete them from the database afterwards?]</li>
        <li>Sign-in codes and reset links: expire in minutes. [FILL IN: how long used or expired codes stay in the database.]</li>
        <li>Backups: [FILL IN: backup schedule of your database host]. Deleted data leaves backups when they expire.</li>
      </ul>

      <h2 style={h2}>5. Your rights and how to use them</h2>
      <ul>
        <li><strong>Download your data:</strong> Settings → Your data → Download my data.</li>
        <li><strong>Delete your account:</strong> Settings → Your data → Delete my account. We delete your content and the files we hold at Cloudinary, then email you to confirm.</li>
        <li><strong>Correct your details:</strong> edit your profile at any time.</li>
        <li><strong>Other requests or complaints:</strong> email [FILL IN: privacy email]. [FILL IN: name and contact of your grievance officer, required in India. Add EU/UK representative and regulator details if you serve those users. Ask a lawyer.]</li>
      </ul>

      <h2 style={h2}>6. Children</h2>
      <p>Emect is for people aged 18 and over. We ask for your date of birth at sign-up and do not create accounts for anyone younger. If you think a child has an account, email us and we will delete it.</p>

      <h2 style={h2}>7. Cookies</h2>
      <p>We use only what is needed to keep you signed in (a session cookie) and to remember your light or dark theme on your device. There are no advertising or analytics cookies, so there is no cookie banner. [FILL IN: revisit if this changes.]</p>

      <h2 style={h2}>8. Security and changes</h2>
      <p>Passwords are hashed, connections use HTTPS, and sign-in attempts are rate limited. If there is a data breach affecting you, we will tell you and the regulator as the law requires. [FILL IN: breach plan owner.] We will update this page when things change and show the date above.</p>
    </LegalPage>
  );
}
