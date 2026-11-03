# Emerge security audit

Scope: auth, sessions, uploads, API input validation and authorization, headers, dependencies. Source reviewed: the committed code in `emerge-app.rar`. Tested offline (helper unit tests + syntax checks); the full app was not run.

## Fixed in this patch

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | High | `session.update()` trusted client-supplied `handle`, `name`, `avatarUrl` and wrote them into the signed JWT, so a user could make their session claim any handle. | `lib/auth.ts`: on update, values are re-read from the database for the signed-in user. |
| 2 | High | Media URL allow-list failed OPEN (any URL accepted) when `CLOUDINARY_CLOUD_NAME` was unset, and used a plain prefix match that `/../` could bypass. Affected posts, reels, profile photo/banner, stories. | New `lib/mediaUrl.ts`: parsed-URL check, fail-closed, rejects traversal, look-alike hosts, userinfo, non-https. |
| 3 | High | Sign-up accepted any email string, any handle (used in `/u/<handle>` links), unbounded names, and case-variant duplicates. | `api/register`: strict email/name/handle validation, reserved names, case-insensitive uniqueness, race-safe create, lower-cased email. |
| 4 | High | Rate limiting silently turned OFF when Upstash env vars were missing, and a Redis error crashed requests. | `lib/rateLimit.ts`: in production falls back to an in-memory limiter (and on Redis errors); open only in local dev. |
| 5 | Medium | Uploads trusted the browser-declared MIME type; no verified-email gate; entire body read before size check; no pixel limit. | `api/uploads`: magic-byte sniffing (rejects SVG/HTML/exe), verified-email gate, early size rejection, `limitInputPixels`, Cloudinary `allowed_formats` for video. |
| 6 | Medium | Login revealed which emails exist through response time (bcrypt only ran for real accounts), and email matching was case-sensitive. | `lib/auth.ts`, `api/login/start`: always run one bcrypt compare; case-insensitive lookup; input length caps. |
| 7 | Medium | Chat GIF URLs were arbitrary, so a sender could track readers' IPs. | Only `https://media*.giphy.com` / `i.giphy.com` accepted. |
| 8 | Medium | OTP HMAC key fell back to the known string `dev-only-secret`. | Throws in production if `NEXTAUTH_SECRET` is missing. |
| 9 | Medium | No CSP, HSTS, Permissions-Policy or COOP; API responses cacheable. | `next.config.mjs` + `netlify.toml`: CSP with an exact host allow-list, HSTS, Permissions-Policy, COOP, `no-store` on `/api`. |
| 10 | Medium | Passwords up to 200 chars, but bcrypt silently ignores bytes after 72; no common-password check. | `lib/password.ts`: 8 to 72 bytes, common/trivial passwords rejected (sign-up and reset). |
| 11 | Low | Unbounded comment text, emoji, community fields, group size; comment on a nonexistent post gave a 500; community creation skipped email verification. | Length/type caps, 404, slug format, verified-email gate, 50-member group cap. |
| 12 | Low | Malformed JSON bodies threw 500s across 20 routes. | `await req.json().catch(() => ({}))` everywhere. |
| 13 | Low | Sessions lasted 30 days. | 7 days, refreshed daily. |

## Checked and fine
- Authorization on posts, conversations, messages, repos (owner/collaborator checks), admin reports (`ADMIN_EMAILS`, server-side).
- Raw SQL: the only `$queryRaw` is a parameterised tagged template. No `eval`, one `dangerouslySetInnerHTML` (a static constant theme script).
- Password-reset and email tokens: 256-bit random, only the SHA-256 is stored, single-use, atomic claim. Login OTP: HMAC-stored, 5-attempt cap, timing-safe compare.
- Email HTML escapes user names. `/api/auth` and `/api/register` have per-IP and per-account limits. No server-side fetch of user-supplied URLs (no SSRF surface).

## Still on you (needs your accounts or a schema change)
1. **Rotate secrets.** Your archive contains a `.env` file (I did not open it). If the archive was shared or uploaded anywhere, rotate `NEXTAUTH_SECRET`, `DATABASE_URL` password, `CLOUDINARY_API_SECRET`, the Gmail app password and the Upstash token.
2. **Set `UPSTASH_REDIS_REST_URL` / `TOKEN` in production**, otherwise limits only work per server instance.
3. **Run `npm audit`** (needs network). `nodemailer 6.9.16` has a newer major with address-parsing fixes; `next 14.2.35` and `next-auth 4.24.7` look current.
4. **Session revocation:** JWT sessions can't be revoked server-side, so a password reset doesn't log out other devices. Fix: add `passwordChangedAt` (or `tokenVersion`) to the `User` model and compare it in the `jwt` callback. Needs a Prisma migration, so I left it out.
5. **Test the CSP in a browser** (login, post, reel upload, GIF picker, hub banners). If something is blocked, the console names the host to add in `next.config.mjs`. Existing members with mixed-case emails still log in (lookup is case-insensitive).
