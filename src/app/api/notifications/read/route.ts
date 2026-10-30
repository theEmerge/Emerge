import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseHub } from "@/lib/hubs";

// Marks every notification in ONE hub as read - called when the
// notifications panel is opened, same "opening it IS reading it" pattern
// used for DM threads.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const hub = parseHub(new URL(req.url).searchParams.get("hub"));
  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, hub, read: false },
    data: { read: true },
  });

  return NextResponse.json({ read: true });
}
