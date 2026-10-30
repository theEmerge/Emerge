import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { email, password, name, handle } = await req.json();

  if (!email || !password || !name || !handle) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { handle }] } });
  if (existing) {
    return NextResponse.json({ error: "user_exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, handle },
  });

  // The OTP code is sent when they log in, so nothing to email here.
  return NextResponse.json({ id: user.id, email: user.email, handle: user.handle });
}
