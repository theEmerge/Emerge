import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";

type Ctx = { params: { id: string } };

async function memberChannel(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, serverId: true } });
  if (!channel) return null;
  const m = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId: channel.serverId, userId } } });
  return m ? channel : null;
}

// First load: the latest 50, oldest first. Polling: ?after=<ISO time> returns
// only newer messages.
export async function GET(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  if (!(await memberChannel(params.id, me.id))) return fail("forbidden", 403);

  const after = new URL(req.url).searchParams.get("after");
  const afterDate = after ? new Date(after) : null;
  if (afterDate && !isNaN(afterDate.getTime())) {
    const messages = await prisma.channelMessage.findMany({
      where: { channelId: params.id, createdAt: { gt: afterDate } },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { author: { select: userSelect } },
    });
    return NextResponse.json({ messages });
  }
  const latest = await prisma.channelMessage.findMany({
    where: { channelId: params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: userSelect } },
  });
  return NextResponse.json({ messages: latest.reverse() });
}

export async function POST(req: Request, { params }: Ctx) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;
  if (!(await memberChannel(params.id, me.id))) return fail("forbidden", 403);
  const b = await readJson(req);
  const body = clean(b.body, 2000);
  if (!body) return fail("empty");
  const message = await prisma.channelMessage.create({
    data: { channelId: params.id, authorId: me.id, body },
    include: { author: { select: userSelect } },
  });
  return NextResponse.json({ message });
}
