import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseHub } from "@/lib/hubs";

// Counts only - what the header badges need. Replaces polling
// /api/conversations (every conversation + all participants) and
// /api/notifications (40 rows with joins) every few seconds on every page.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const hub = parseHub(new URL(req.url).searchParams.get("hub"));

  const [msgRows, notifs] = await Promise.all([
    // A conversation is unread when its newest message is from someone else
    // and newer than this user's lastReadAt (same rule as /api/conversations).
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM "ConversationParticipant" cp
      JOIN "Conversation" c ON c."id" = cp."conversationId"
      WHERE cp."userId" = ${userId}
        AND c."hub" = ${hub}
        AND EXISTS (
          SELECT 1 FROM "Message" m
          WHERE m."conversationId" = cp."conversationId"
            AND m."senderId" <> ${userId}
            AND m."createdAt" > cp."lastReadAt"
            AND m."createdAt" = (
              SELECT MAX(m2."createdAt") FROM "Message" m2 WHERE m2."conversationId" = cp."conversationId"
            )
        )`,
    prisma.notification.count({ where: { recipientId: userId, hub, read: false } }),
  ]);

  return NextResponse.json({ messages: msgRows[0]?.n ?? 0, notifications: notifs });
}
