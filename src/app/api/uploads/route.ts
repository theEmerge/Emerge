import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadImage, uploadVideo } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireVerifiedEmail } from "@/lib/verified";

// Hard ceiling on the request body (videos are 100MB; a little headroom for multipart overhead).
const MAX_BODY_BYTES = 105 * 1024 * 1024;

// The browser-declared MIME type is attacker-controlled, so decide what the
// file really is from its first bytes.
function sniff(buf: Buffer): "image" | "video" | null {
  if (buf.length < 12) return null;
  const hex4 = buf.subarray(0, 4).toString("hex");
  if (hex4 === "ffd8ffe0" || hex4 === "ffd8ffe1" || hex4 === "ffd8ffdb" || hex4 === "ffd8ffee" || buf.subarray(0, 3).toString("hex") === "ffd8ff") return "image"; // JPEG
  if (buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image"; // PNG
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image"; // WebP
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return "image"; // GIF
  const brand = buf.subarray(4, 12).toString("ascii");
  if (brand.startsWith("ftyp")) {
    // HEIC/HEIF photos share the ISO container with MP4/MOV video.
    const major = buf.subarray(8, 12).toString("ascii");
    return /^(heic|heix|hevc|hevx|mif1|msf1|avif)/.test(major) ? "image" : "video";
  }
  if (hex4 === "1a45dfa3") return "video"; // WebM / Matroska
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const unverified = await requireVerifiedEmail(session.user.id);
  if (unverified) return unverified;

  const limited = await checkRateLimit(`upload:${session.user.id}`, "upload");
  if (!limited.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Refuse oversized bodies before reading them into memory.
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BODY_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const kind = sniff(buffer);
  if (!kind) return NextResponse.json({ error: "not_an_image" }, { status: 400 });
  const isVideo = kind === "video";

  try {
    const url = isVideo ? await uploadVideo(buffer, session.user.id) : await uploadImage(buffer, session.user.id);
    return NextResponse.json({ url, kind: isVideo ? "video" : "image" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upload_failed";
    if (msg === "FILE_TOO_LARGE") {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }
    if (msg.startsWith("STORAGE_NOT_CONFIGURED")) {
      console.error(msg);
      return NextResponse.json({ error: "storage_not_configured" }, { status: 500 });
    }
    // sharp throws on corrupt / non-decodable / oversized-pixel images.
    if (/Input (buffer|file)|unsupported image format|pixel limit|corrupt/i.test(msg)) {
      return NextResponse.json({ error: "not_an_image" }, { status: 400 });
    }
    console.error("upload_failed", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
