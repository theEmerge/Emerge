import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/verified";
import { deletePostCascade } from "@/lib/moderation";

// Team-only. action "dismiss": nothing wrong. action "remove": delete the
// reported post / comment, or blank the reported message. Reported profiles
// have no auto-removal - the team decides what to do and then dismisses.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminEmail(session.user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { action } = await req.json().catch(() => ({}));
  if (action !== "dismiss" && action !== "remove") return NextResponse.json({ error: "invalid_action" }, { status: 400 });

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "remove") {
    if (report.targetType === "POST") {
      await deletePostCascade(report.targetId).catch(() => {}); // already gone is fine
    } else if (report.targetType === "COMMENT") {
      await prisma.comment.deleteMany({ where: { id: report.targetId } });
    } else if (report.targetType === "MESSAGE") {
      await prisma.message.updateMany({ where: { id: report.targetId }, data: { text: "[removed by moderators]", gifUrl: null } });
    } else {
      return NextResponse.json({ error: "cannot_remove_user" }, { status: 400 });
    }
  }

  // Close every open report about the same thing in one go.
  await prisma.report.updateMany({
    where: { targetType: report.targetType, targetId: report.targetId, status: "OPEN" },
    data: { status: action === "remove" ? "REMOVED" : "DISMISSED", reviewedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
