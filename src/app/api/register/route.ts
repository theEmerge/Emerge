import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/password";

// Handles become URLs (/u/<handle>), so they're restricted to a safe alphabet
// and can't impersonate site routes or staff.
const HANDLE_RE = /^[A-Za-z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+\.[^\s@<>()"',;:\\]{2,}$/;
const RESERVED = new Set([
  "admin", "administrator", "root", "support", "help", "emerge", "official", "staff", "team", "moderator", "mod",
  "api", "login", "register", "settings", "search", "discover", "reels", "saved", "hubs", "game", "developer",
  "connection", "messages", "notifications", "u", "null", "undefined",
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { email, password, name, handle } = body as Record<string, unknown>;

  if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string" || typeof handle !== "string" || !email || !password || !name || !handle) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.replace(/\s+/g, " ").trim();
  const cleanHandle = handle.trim().replace(/^@/, "");

  if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  if (cleanName.length < 1 || cleanName.length > 50) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  if (!HANDLE_RE.test(cleanHandle) || RESERVED.has(cleanHandle.toLowerCase())) return NextResponse.json({ error: "invalid_handle" }, { status: 400 });
  const pwProblem = passwordProblem(password, { email: cleanEmail, handle: cleanHandle });
  if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

  // Case-insensitive, so "Maya" and "maya" (or A@x.com / a@x.com) can't be two people.
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: cleanEmail, mode: "insensitive" } },
        { handle: { equals: cleanHandle, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "user_exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { email: cleanEmail, passwordHash, name: cleanName, handle: cleanHandle },
    });
    // The OTP code is sent when they log in, so nothing to email here.
    return NextResponse.json({ id: user.id, email: user.email, handle: user.handle });
  } catch (e) {
    // Two sign-ups racing past the check above hit the unique constraint.
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "user_exists" }, { status: 409 });
    throw e;
  }
}
