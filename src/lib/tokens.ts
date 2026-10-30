import { createHash, randomBytes } from "crypto";
import type { AuthTokenType } from "@prisma/client";
import { prisma } from "./prisma";

// One-time email tokens. Only the SHA-256 hash is stored, so a database leak
// does not leak usable reset links. A token works once and expires.

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

export async function createAuthToken(userId: string, type: AuthTokenType, ttlMinutes: number): Promise<string> {
  // A new request invalidates any older unused link of the same kind.
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const raw = randomBytes(32).toString("base64url");
  await prisma.authToken.create({
    data: { userId, type, tokenHash: hash(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return raw;
}

// Marks the token used and returns its userId, or null if it is unknown,
// expired or already used. The updateMany is atomic, so two clicks at the
// same moment cannot both succeed.
export async function consumeAuthToken(raw: string, type: AuthTokenType): Promise<string | null> {
  if (!raw || typeof raw !== "string" || raw.length > 200) return null;
  const tokenHash = hash(raw);
  const claimed = await prisma.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return row?.userId ?? null;
}
