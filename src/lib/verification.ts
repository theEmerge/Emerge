import { createEmailOtp, OTP_TTL_MINUTES } from "./otp";
import { sendEmail, appUrl } from "./email";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function layout(inner: string): string {
  return (
    `<div style="background:#f4f6fb;padding:24px 12px;font-family:Inter,Segoe UI,Arial,sans-serif;">` +
    `<div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #e3e7ef;border-radius:14px;padding:28px;color:#14171f;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>` +
    `<td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;border-radius:19px;background:#ff5d3b;color:#ffffff;font-family:Manrope,'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:800;line-height:36px;">e</td>` +
    `<td style="padding-left:10px;font-family:Manrope,'Helvetica Neue',Arial,sans-serif;font-size:25px;font-weight:800;letter-spacing:-1.5px;color:#171713;line-height:38px;">emerge</td>` +
    `</tr></table>` +
    inner +
    `</div>` +
    `<div style="max-width:440px;margin:12px auto 0;text-align:center;font-size:11px;color:#8a92a3;">Sent by Emerge &middot; ${esc(appUrl())}</div>` +
    `</div>`
  );
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }): Promise<boolean> {
  const code = await createEmailOtp(user.id);
  return sendEmail({
    to: user.email,
    subject: `${code} is your Emerge verification code`,
    text:
      `Hi ${user.name},\n\n` +
      `Your Emerge verification code is: ${code}\n\n` +
      `It expires in ${OTP_TTL_MINUTES} minutes. Never share this code with anyone - Emerge will never ask for it.\n\n` +
      `If you didn't create an account, ignore this email.`,
    html: layout(
      `<p style="margin:0 0 12px;font-size:15px;">Hi ${esc(user.name)},</p>` +
        `<p style="margin:0 0 16px;font-size:15px;">Use this code to confirm your email:</p>` +
        `<div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;background:#eef3ff;color:#1d6bff;border-radius:10px;padding:16px 0 16px 10px;margin:0 0 16px;">${code}</div>` +
        `<p style="margin:0 0 8px;font-size:13px;color:#4b5365;">It expires in ${OTP_TTL_MINUTES} minutes. Never share this code with anyone &ndash; Emerge will never ask for it.</p>` +
        `<p style="margin:0;font-size:13px;color:#4b5365;">If you didn't create an account, you can ignore this email.</p>`
    ),
  });
}

// Sent right after the code is accepted.
export async function sendConfirmationEmail(user: { email: string; name: string }): Promise<boolean> {
  return sendEmail({
    to: user.email,
    subject: "Your email is confirmed - welcome to Emerge",
    text:
      `Hi ${user.name},\n\n` +
      `Your email is confirmed. You can now post, message and share on Emerge:\n\n` +
      `${appUrl()}\n\n` +
      `If this wasn't you, reset your password at ${appUrl()}/forgot-password.`,
    html: layout(
      `<p style="margin:0 0 12px;font-size:15px;">Hi ${esc(user.name)},</p>` +
        `<p style="margin:0 0 6px;font-size:17px;font-weight:700;">Your email is confirmed &#10003;</p>` +
        `<p style="margin:0 0 18px;font-size:15px;">You can now post, message and share on Emerge.</p>` +
        `<a href="${esc(appUrl())}" style="display:inline-block;background:#1d6bff;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:10px;">Open Emerge</a>` +
        `<p style="margin:18px 0 0;font-size:12px;color:#6b7385;">If this wasn't you, <a href="${esc(appUrl())}/forgot-password" style="color:#1d6bff;">reset your password</a>.</p>`
    ),
  });
}


// Sent at login: the second step after the password is accepted.
export async function sendLoginCodeEmail(user: { id: string; email: string; name: string }): Promise<boolean> {
  const code = await createEmailOtp(user.id);
  return sendEmail({
    to: user.email,
    subject: `${code} is your Emerge login code`,
    text:
      `Hi ${user.name},\n\n` +
      `Your Emerge login code is: ${code}\n\n` +
      `It expires in ${OTP_TTL_MINUTES} minutes. Never share this code with anyone - Emerge will never ask for it.\n\n` +
      `If you didn't try to log in, reset your password at ${appUrl()}/forgot-password.`,
    html: layout(
      `<p style="margin:0 0 12px;font-size:15px;">Hi ${esc(user.name)},</p>` +
        `<p style="margin:0 0 16px;font-size:15px;">Use this code to finish logging in:</p>` +
        `<div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;background:#eef3ff;color:#1d6bff;border-radius:10px;padding:16px 0 16px 10px;margin:0 0 16px;">${code}</div>` +
        `<p style="margin:0 0 8px;font-size:13px;color:#4b5365;">It expires in ${OTP_TTL_MINUTES} minutes. Never share this code with anyone &ndash; Emerge will never ask for it.</p>` +
        `<p style="margin:0;font-size:13px;color:#4b5365;">If this wasn't you, <a href="${esc(appUrl())}/forgot-password" style="color:#1d6bff;">reset your password</a>.</p>`
    ),
  });
}
