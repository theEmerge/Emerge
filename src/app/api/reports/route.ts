import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendEmail, appUrl } from "@/lib/email";
import { adminEmails } from "@/lib/verified";
import { REPORT_REASONS } from "@/lib/reports";

// Report a post, comment, DM message or profile. The team reviews these
// daily at /admin/reports. The reported text is copied into `snapshot`.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = session.user.id;

  const limited = await checkRateLimit(`report:${me}`, "post");
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const { targetType, targetId, reason } = body;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  if (!["POST", "COMMENT", "MESSAGE", "USER"].includes(targetType) || typeof targetId !== "string" || !targetId) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  let targetUserId: string | null = null;
  let snapshot: string | null = null;

  if (targetType === "POST") {
    const p = await prisma.post.findUnique({ where: { id: targetId }, select: { userId: true, text: true, imageUrl: true, videoUrl: true } });
    if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
    targetUserId = p.userId;
    snapshot = [p.text, p.videoUrl || p.imageUrl].filter(Boolean).join("\n").slice(0, 1000) || null;
  } else if (targetType === "COMMENT") {
    const c = await prisma.comment.findUnique({ where: { id: targetId }, select: { userId: true, text: true } });
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
    targetUserId = c.userId;
    snapshot = c.text.slice(0, 1000);
  } else if (targetType === "MESSAGE") {
    // Only a participant of the conversation can report one of its messages.
    const m = await prisma.message.findUnique({ where: { id: targetId }, select: { senderId: true, text: true, gifUrl: true, conversationId: true } });
    if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const member = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: m.conversationId, userId: me } },
    });
    if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });
    targetUserId = m.senderId;
    snapshot = (m.text || m.gifUrl || "").slice(0, 1000) || null;
  } else {
    const u = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, handle: true, bio: true } });
    if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });
    targetUserId = u.id;
    snapshot = `@${u.handle}${u.bio ? " - " + u.bio : ""}`.slice(0, 1000);
  }

  if (targetUserId === me) return NextResponse.json({ error: "cannot_report_self" }, { status: 400 });

  // Reporting the same thing twice is not an error, it just doesn't duplicate.
  const report = await prisma.report.upsert({
    where: { reporterId_targetType_targetId: { reporterId: me, targetType, targetId } },
    create: { reporterId: me, targetType, targetId, targetUserId, reason, note, snapshot },
    update: {},
  });

  // Heads-up email to the team (best effort; the dashboard is the source of truth).
  const admins = adminEmails();
  if (admins.length) {
    await Promise.all(
      admins.map((to) =>
        sendEmail({
          to,
          subject: `Emerge report: ${targetType.toLowerCase()} (${reason})`,
          text: `New report.\n\nType: ${targetType}\nReason: ${reason}\n${note ? `Note: ${note}\n` : ""}\nReview: ${appUrl()}/admin/reports`,
        })
      )
    );
  }

  return NextResponse.json({ ok: true, id: report.id });
}
