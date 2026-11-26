import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

// "Download my data": everything we hold that was created by, or is about,
// the logged-in user, as one JSON file. The password hash, login codes and
// reset tokens are left out on purpose (security, not personal content).
const T = { take: 5000 } as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = session.user.id;

  const limited = await checkRateLimit(`export:${id}`, "login");
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const data = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, handle: true, name: true, bio: true, avatarUrl: true, bannerUrl: true,
      createdAt: true, emailVerifiedAt: true, termsAcceptedAt: true,
      posts: T, rolls: T, comments: T, likes: T, helpfulMarks: T, saved: T, reshares: T,
      stories: T, storyViews: T, messages: T, messageReactions: T, postTags: T,
      following: T, followers: T, blocksMade: T, reportsMade: T,
      communityMemberships: T, notificationsReceived: T,
      proProfile: true, proExperiences: T, proPosts: T, eventsHosted: T, eventRsvps: T, companiesOwned: T, jobsPosted: T,
    },
  });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), service: "Emect", account: data }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="emect-data-${data.handle}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
