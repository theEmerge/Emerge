// Same idea as cloudinaryLoader.ts but for <video> - next/image's loader
// only applies to <Image>, so reel playback gets its own small helper
// that asks Cloudinary for an auto-format/auto-quality delivery of the
// same uploaded file rather than the raw original.
export function cldVideoUrl(url: string | null | undefined): string {
  if (!url) return "";
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return url.slice(0, idx + marker.length) + "f_auto,q_auto" + "/" + url.slice(idx + marker.length);
}
