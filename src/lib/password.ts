import bcrypt from "bcryptjs";

// One place for the password rules used by sign-up and password reset.
// bcrypt only reads the first 72 BYTES, so anything longer would be silently
// truncated - reject it instead of pretending it all counts.
const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123",
  "iloveyou", "letmein1", "welcome1", "admin123", "abc12345", "11111111", "00000000", "emerge123", "emergeemerge",
]);

export function passwordProblem(pw: unknown, context: { email?: string; handle?: string } = {}): string | null {
  if (typeof pw !== "string") return "weak_password";
  if (pw.length < 8) return "weak_password";
  if (Buffer.byteLength(pw, "utf8") > 72) return "password_too_long";
  const lower = pw.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(pw)) return "weak_password";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if ((local && local.length >= 4 && lower === local) || (context.handle && lower === context.handle.toLowerCase())) return "weak_password";
  return null;
}

// A real bcrypt hash (made once at load) compared against when the account
// doesn't exist, so "unknown email" and "wrong password" take the same time.
export const DUMMY_HASH = bcrypt.hashSync("emerge-timing-equaliser", 10);
