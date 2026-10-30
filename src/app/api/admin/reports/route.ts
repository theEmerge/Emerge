import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/verified";

// Team-only: open reports, oldest first. Admins = emails in ADMIN_EMAILS.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      reporter: { select: { handle: true } },
      targetUser: { select: { id: true, handle: true, name: true } },
    },
  });
  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      note: r.note,
      snapshot: r.snapshot,
      createdAt: r.createdAt,
      reporter: r.reporter.handle,
      targetUser: r.targetUser,
    })),
  });
}
