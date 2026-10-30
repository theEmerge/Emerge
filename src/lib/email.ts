// Sends email. Order of preference:
//  1. Gmail SMTP  - set GMAIL_USER (theemergeweb@gmail.com) and GMAIL_APP_PASSWORD
//     (a 16-character Google "App password", NOT the normal account password).
//  2. Resend      - set RESEND_API_KEY and EMAIL_FROM (needs a domain you verified).
//  3. Neither set - the email is only printed to the server log (local dev).
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export function appUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.URL || "http://localhost:3000").replace(/\/$/, "");
}

let gmail: Transporter | null = null;
function gmailTransport(): Transporter | null {
  const user = process.env.GMAIL_USER?.trim();
  // Google shows app passwords as "abcd efgh ijkl mnop" - the spaces are optional.
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  if (!gmail) {
    gmail = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return gmail;
}

export async function sendEmail(params: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  const g = gmailTransport();
  if (g) {
    try {
      await g.sendMail({
        from: `Emerge <${process.env.GMAIL_USER!.trim()}>`,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return true;
    } catch (e) {
      console.error("[email] Gmail send failed", e);
      return false;
    }
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn(`[email] No GMAIL_USER/GMAIL_APP_PASSWORD or RESEND_API_KEY/EMAIL_FROM set - NOT sent: "${params.subject}" to ${params.to}`);
    if (process.env.NODE_ENV !== "production") console.log(params.text);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: params.to, subject: params.subject, text: params.text, html: params.html }),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}
