import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadImage, uploadVideo } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = await checkRateLimit(`upload:${session.user.id}`, "upload");
  if (!limited.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: "not_an_image" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

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
    console.error("upload_failed", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
