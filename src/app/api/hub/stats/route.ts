import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionUser, unauthorized } from "@/lib/hub";

type Stat = { key: string; label: string; value: number; note?: string };

// GET ?hub=social|connection|developer|game -> a few real counts for that hub's home row.
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const hub = new URL(req.url).searchParams.get("hub");
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let stats: Stat[] = [];

  if (hub === "social") {
    const [followers, following, posts, communities] = await Promise.all([
      prisma.follow.count({ where: { followingId: me.id } }),
      prisma.follow.count({ where: { followerId: me.id } }),
      prisma.post.count({ where: { userId: me.id, createdAt: { gte: weekAgo } } }),
      prisma.communityMembership.count({ where: { userId: me.id } }),
    ]);
    stats = [
      { key: "followers", label: "Followers", value: followers },
      { key: "following", label: "Following", value: following },
      { key: "posts", label: "Posts this week", value: posts },
      { key: "communities", label: "Communities joined", value: communities },
    ];
  } else if (hub === "connection") {
    const [connections, pending, applicants, going] = await Promise.all([
      prisma.proConnection.count({ where: { status: "ACCEPTED", OR: [{ requesterId: me.id }, { addresseeId: me.id }] } }),
      prisma.proConnection.count({ where: { status: "PENDING", addresseeId: me.id } }),
      prisma.jobApplication.count({ where: { job: { posterId: me.id } } }),
      prisma.eventRsvp.count({ where: { userId: me.id, event: { startsAt: { gte: now } } } }),
    ]);
    stats = [
      { key: "connections", label: "Connections", value: connections },
      { key: "pending", label: "Requests waiting", value: pending, note: pending ? "Review in Network" : undefined },
      { key: "applicants", label: "Job applicants", value: applicants },
      { key: "events", label: "Events you're going to", value: going },
    ];
  } else if (hub === "developer") {
    const mine = { repo: { ownerId: me.id } };
    const [repos, issues, pulls, commits] = await Promise.all([
      prisma.repo.count({ where: { ownerId: me.id } }),
      prisma.issue.count({ where: { ...mine, status: "OPEN" } }),
      prisma.pullRequest.count({ where: { ...mine, status: "OPEN" } }),
      prisma.commit.count({ where: { authorId: me.id, createdAt: { gte: weekAgo } } }),
    ]);
    stats = [
      { key: "repos", label: "Repositories", value: repos },
      { key: "issues", label: "Open issues", value: issues },
      { key: "pulls", label: "Open pull requests", value: pulls },
      { key: "commits", label: "Commits this week", value: commits },
    ];
  } else if (hub === "game") {
    const following = await prisma.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } });
    const ids = following.map((f) => f.followingId);
    const [joined, owned, friendsPlaying, lfg] = await Promise.all([
      prisma.serverMember.count({ where: { userId: me.id } }),
      prisma.gameServer.count({ where: { ownerId: me.id } }),
      prisma.gamePresence.count({ where: { userId: { in: ids } } }),
      prisma.lfgPost.count({ where: { open: true } }),
    ]);
    stats = [
      { key: "joined", label: "Servers joined", value: joined },
      { key: "owned", label: "Servers you run", value: owned },
      { key: "friends", label: "Friends playing", value: friendsPlaying },
      { key: "lfg", label: "Open party posts", value: lfg },
    ];
  } else {
    return NextResponse.json({ error: "invalid_hub" }, { status: 400 });
  }
  return NextResponse.json({ stats });
}
