// Video files from a phone camera are routinely 20-100MB+ - well past the
// ~6MB request body limit Netlify's serverless functions enforce (an AWS
// Lambda platform limit, not something app code can raise). So reels upload
// straight from the browser to Cloudinary.
//
// Uploads are SIGNED: we first ask our own server (POST /api/uploads/sign)
// for a short-lived signature. The server only hands one out to a logged-in,
// email-verified user, and the signature locks the folder and the allowed
// formats. There is no public unsigned preset any more, so no
// NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET variable is needed (delete it in
// Netlify, and delete the unsigned "emerge" preset in Cloudinary).
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export async function uploadVideoDirect(file: File, onProgress?: (pct: number) => void): Promise<string> {
  // Client-side checks are only for friendly errors.
  if (file.size > MAX_VIDEO_BYTES) throw new Error("VIDEO_TOO_LARGE");
  if (!file.type.startsWith("video/")) throw new Error("VIDEO_BAD_FORMAT");

  const signRes = await fetch("/api/uploads/sign", { method: "POST" }).catch(() => null);
  if (!signRes) throw new Error("upload_failed");
  if (signRes.status === 403) throw new Error("EMAIL_NOT_VERIFIED");
  if (signRes.status === 429) throw new Error("RATE_LIMITED");
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}));
    throw new Error(body.error === "not_configured" ? "CLOUDINARY_NOT_CONFIGURED" : "upload_failed");
  }
  const sig = await signRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  form.append("allowed_formats", sig.allowedFormats);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText).secure_url as string);
        } catch {
          reject(new Error("upload_failed"));
        }
      } else {
        reject(new Error("upload_failed"));
      }
    };
    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.send(form);
  });
}
