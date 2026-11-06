// Small client helpers shared by every hub screen.

export type ApiResult<T = any> = { ok: boolean; status: number; data: T };

export async function call<T = any>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } as T };
  }
}

const MESSAGES: Record<string, string> = {
  title_required: "Give the event a title.",
  invalid_date: "Pick a valid start date and time.",
  date_in_past: "The start time has to be in the future.",
  invalid_end: "The end time must be after the start.",
  location_required: "Add a location, or mark the event as online.",
  host_cannot_leave: "You're hosting this event. Delete it instead if it's off.",
  email_not_verified: "Your email isn't verified yet. Log out and log back in with the emailed code.",
  rate_limited: "Slow down a little and try again in a moment.",
  network: "Couldn't reach the server. Check your connection and try again.",
  unauthorized: "Please log in again.",
  forbidden: "You don't have permission to do that.",
  not_found: "That doesn't exist or isn't visible to you.",
  missing_fields: "Fill in the required fields.",
  name_taken: "That name is already taken.",
  blocked: "That isn't possible with this person.",
  not_connected: "You need to be connected to do that.",
  already_applied: "You've already applied to this job.",
  party_full: "That party is full.",
  invalid_code: "That invite code doesn't match any server.",
  bad_name: "Use letters, numbers, dots, dashes or underscores.",
  bad_path: "That file path isn't valid.",
  no_changes: "Nothing changed.",
  content_too_large: "That file is too large (about 1 MB max, 750 KB for images and other binary files).",
  bad_content: "That file contains characters that can't be stored.",
  no_files: "Choose at least one file.",
  too_many_files: "This branch is full (1,000 files max).",
  too_many_files_at_once: "That's too many files for one commit. Try a smaller batch.",
  upload_too_large: "That upload is too big for one commit. Try fewer files at a time.",
  branch_not_found: "That branch doesn't exist.",
  already_open: "A pull request for those branches is already open.",
  same_branch: "Pick two different branches.",
};

export function errorText(data: any): string {
  const code = data?.error as string | undefined;
  return (code && MESSAGES[code]) || "Something went wrong. Try again.";
}

// Open (or create) a direct message with someone in that hub's own inbox.
export async function openDm(userId: string, hub: "connection" | "developer" | "game"): Promise<string | null> {
  const r = await call("POST", "/api/conversations", { userId, hub });
  return r.ok && r.data?.id ? (r.data.id as string) : null;
}
