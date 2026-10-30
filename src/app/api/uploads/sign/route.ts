import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireVerifiedEmail } from "@/lib/verified";

// Signed direct uploads for reels (videos are too big to pass through a
// Netlify function). The browser asks us for a short-lived signature, then
// uploads straight to Cloudinary. The signature covers the folder and the
// allowed formats, so a client can't change them - and only logged-in,
// email-verified users get one. This replaces the old unsigned preset.
const FOLDER = "emerge/reels";
const ALLOWED_FORMATS = "mp4,mov,webm";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const unverified = await requireVerifiedEmail(session.user.id);
  if (unverified) return unverified;

  const limited = await checkRateLimit(`sign:${session.user.id}`, "upload");
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signs the params sorted alphabetically, "k=v&k=v", + the secret, SHA-1.
  const toSign = `allowed_formats=${ALLOWED_FORMATS}&folder=${FOLDER}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");

  return NextResponse.json({ cloudName, apiKey, timestamp, signature, folder: FOLDER, allowedFormats: ALLOWED_FORMATS });
}
