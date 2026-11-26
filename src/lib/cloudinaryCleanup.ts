import { v2 as cloudinary } from "cloudinary";

// Deletes files from Cloudinary given the public https://res.cloudinary.com/... URLs
// we stored. Best effort: a failure here must never stop an account deletion,
// so it reports how many it removed and swallows errors.
function parse(url: string): { id: string; type: "image" | "video" } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "res.cloudinary.com") return null;
    const m = u.pathname.match(/^\/[^/]+\/(image|video)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!m) return null;
    const id = decodeURIComponent(m[2]).replace(/\.[A-Za-z0-9]{2,5}$/, "");
    return { id, type: m[1] as "image" | "video" };
  } catch {
    return null;
  }
}

export async function deleteCloudinaryFiles(urls: (string | null | undefined)[]): Promise<number> {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!name || !key || !secret) return 0;
  cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });

  const groups: Record<"image" | "video", string[]> = { image: [], video: [] };
  for (const u of new Set(urls.filter((x): x is string => !!x))) {
    const p = parse(u);
    if (p) groups[p.type].push(p.id);
  }
  let removed = 0;
  for (const type of ["image", "video"] as const) {
    for (let i = 0; i < groups[type].length; i += 100) {
      try {
        await cloudinary.api.delete_resources(groups[type].slice(i, i + 100), { resource_type: type, invalidate: true });
        removed += Math.min(100, groups[type].length - i);
      } catch (e) {
        console.error("[account] cloudinary delete failed", type, (e as Error)?.message);
      }
    }
  }
  return removed;
}
