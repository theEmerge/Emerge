// Custom loader for next/image (see next.config.mjs). Cloudinary URLs look
// like https://res.cloudinary.com/<cloud>/image/upload/v123/emerge/... -
// inserting a transformation segment right after "/upload/" asks
// Cloudinary's CDN to resize/re-encode on the fly, so every viewer gets a
// file sized for their actual screen instead of the original upload.
//
// Non-Cloudinary sources (local files like /logo.png) don't have an
// "/upload/" segment, so they're returned untouched - Next still renders
// them, just without the width-based optimization.
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const marker = "/upload/";
  const idx = src.indexOf(marker);
  if (idx === -1) return src;

  const params = ["f_auto", `q_${quality ?? "auto"}`, `w_${width}`, "c_limit"];
  return src.slice(0, idx + marker.length) + params.join(",") + "/" + src.slice(idx + marker.length);
}
