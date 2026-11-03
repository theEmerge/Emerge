// Allow-lists for user-supplied media URLs. Fail CLOSED: if the storage
// account isn't configured, nothing is accepted (the old checks accepted
// every URL when CLOUDINARY_CLOUD_NAME was missing).

// True only for https://res.cloudinary.com/<our cloud>/... URLs. The URL is
// parsed (not prefix-matched) so "..", encoded dots, userinfo tricks and
// look-alike hosts can't slip past, e.g. https://res.cloudinary.com/<cloud>/../<other>/x.
export function isOwnMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 600) return false;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com" || u.port || u.username || u.password) return false;
  let path: string;
  try {
    path = decodeURIComponent(u.pathname);
  } catch {
    return false;
  }
  if (path.split("/").some((seg) => seg === ".." || seg === ".")) return false;
  return u.pathname.startsWith(`/${cloud}/`);
}

// GIFs in chat come from Giphy's CDN only.
export function isGiphyUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && /^(media\d*|i)\.giphy\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}
