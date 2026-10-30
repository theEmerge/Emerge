export function timeAgo(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - t.getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return t.toLocaleDateString();
}
