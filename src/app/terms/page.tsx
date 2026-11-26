import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Emect, what you own, what is not allowed and how to report content or a copyright problem.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const h2 = { fontSize: 22, margin: "32px 0 8px" } as const;

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="[FILL IN: date]">
      <p>By creating an account you agree to these terms. Emect is run by [FILL IN: legal name and address].</p>

      <h2 style={h2}>1. Who can use Emect</h2>
      <p>You must be 18 or over and give true information. Keep your password private; you are responsible for activity on your account.</p>

      <h2 style={h2}>2. Your content</h2>
      <p>You keep ownership of what you post. You give Emect permission to store, display and deliver it so the service works. Only post what you have the right to share. [FILL IN: licence wording. Ask a lawyer.]</p>

      <h2 style={h2}>3. What is not allowed</h2>
      <ul>
        <li>Harassment, hate, threats, or content that sexualises or endangers children.</li>
        <li>Illegal content, scams, spam, malware, or impersonating others.</li>
        <li>Posting other people&apos;s private information or content you do not have rights to.</li>
        <li>Trying to break, overload or bypass the security of the service.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules. [FILL IN: appeal process.]</p>

      <h2 style={h2}>4. Reporting content</h2>
      <p>Use the Report option on a post, comment, message or profile. Our team reviews reports. You can also email [FILL IN: contact email].</p>

      <h2 style={h2}>5. Copyright complaints</h2>
      <p>If you believe something on Emect infringes your copyright, email [FILL IN: copyright contact] with: what the work is, the link to the content, your contact details, a statement that you act in good faith and that the information is accurate. We will review it and remove content where appropriate. [FILL IN: DMCA designated agent if you serve US users. Ask a lawyer.]</p>

      <h2 style={h2}>6. Deleting your account</h2>
      <p>You can delete your account at any time from Settings. See the <a href="/privacy">Privacy Policy</a> for what happens to your data.</p>

      <h2 style={h2}>7. Service and liability</h2>
      <p>Emect is provided as it is and may change or be unavailable at times. [FILL IN: limits of liability, governing law and where disputes are heard. Ask a lawyer.]</p>

      <h2 style={h2}>8. Contact</h2>
      <p>[FILL IN: contact email and grievance officer details.]</p>
    </LegalPage>
  );
}
