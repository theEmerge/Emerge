import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { createAuthToken } from "@/lib/tokens";
import { sendEmail, appUrl } from "@/lib/email";

// Always answers the same way whether or not the email has an account, so
// this can't be used to find out who is registered.
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const reply = NextResponse.json({ ok: true });
  if (typeof email !== "string" || !email.includes("@") || email.length > 254) return reply;

  const clean = email.trim();
  const limited = await checkRateLimit(`forgot:${clean.toLowerCase()}`, "email");
  if (!limited.success) return reply; // same reply, no email sent

  const user = await prisma.user.findFirst({
    where: { email: { equals: clean, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
  if (!user) return reply;

  const token = await createAuthToken(user.id, "PASSWORD_RESET", 30);
  await sendEmail({
    to: user.email,
    subject: "Reset your Emerge password",
    text:
      `Hi ${user.name},\n\n` +
      `Use this link to choose a new password. It works once and expires in 30 minutes:\n\n` +
      `${appUrl()}/reset-password?token=${token}\n\n` +
      `If you didn't ask for this, ignore this email - your password stays the same.`,
  });
  return reply;
}
