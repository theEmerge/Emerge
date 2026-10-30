import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

// Cloudinary, not S3-compatible storage - chosen specifically because its
// free tier requires no credit card at signup, unlike Backblaze B2 or
// Cloudflare R2. Uploads still go through our own re-encoding step below
// before they ever leave the server, so Cloudinary only ever receives an
// already-stripped, already-resized file.
let configured = false;

function configureCloudinary() {
  if (configured) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "STORAGE_NOT_CONFIGURED: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  configured = true;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB raw upload ceiling
const MAX_DIMENSION = 2400; // longest edge, px - plenty for any feed/profile view

// Accepts a raw image buffer, re-encodes it (strips EXIF/GPS, caps
// dimensions, converts to webp) and uploads it to Cloudinary. Re-encoding
// server-side is deliberate: it's both a size/cost control and a safety
// measure (a client-supplied file is never trusted or stored as-is).
export async function uploadImage(buffer: Buffer, userId: string): Promise<string> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  configureCloudinary();

  const processed = await sharp(buffer)
    .rotate() // apply EXIF orientation, then strip metadata by re-encoding
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `emerge/posts/${userId}`,
        resource_type: "image",
        format: "webp",
      },
      (error, result) => {
        if (error || !result) {
          reject(error instanceof Error ? error : new Error("upload_failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(processed);
  });
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB raw ceiling for reels

// Video can't be re-encoded server-side with sharp (that's image-only), so
// unlike uploadImage this passes the raw bytes straight to Cloudinary and
// leans on its own size/format handling. Still routed through our own
// upload endpoint (never a client-supplied URL) for the same reason
// uploadImage is - see POST /api/uploads.
export async function uploadVideo(buffer: Buffer, userId: string): Promise<string> {
  if (buffer.byteLength > MAX_VIDEO_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  configureCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `emerge/reels/${userId}`,
        resource_type: "video",
      },
      (error, result) => {
        if (error || !result) {
          reject(error instanceof Error ? error : new Error("upload_failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
