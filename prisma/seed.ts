import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const [mara, theo, nadia, you] = await Promise.all([
    prisma.user.upsert({
      where: { email: "mara@example.com" },
      update: {},
      create: { email: "mara@example.com", handle: "marac", name: "Mara Chen", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "theo@example.com" },
      update: {},
      create: { email: "theo@example.com", handle: "theob", name: "Theo Brandt", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "nadia@example.com" },
      update: {},
      create: { email: "nadia@example.com", handle: "nadiao", name: "Nadia Okafor", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "you@example.com" },
      update: {},
      create: { email: "you@example.com", handle: "you", name: "You", passwordHash },
    }),
  ]);

  // you follow mara, theo, nadia
  for (const target of [mara, theo, nadia]) {
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: you.id, followingId: target.id } },
      update: {},
      create: { followerId: you.id, followingId: target.id },
    });
  }

  const date = startOfDay();

  const maraRoll = await prisma.roll.upsert({
    where: { userId_date: { userId: mara.id, date } },
    update: {},
    create: { userId: mara.id, date, framesUsed: 9, maxFrames: 24 },
  });

  await prisma.post.create({
    data: {
      userId: mara.id,
      text: "Golden hour on the fire escape. Brooklyn never disappoints.",
      imageUrl: "https://picsum.photos/seed/aperture-1/900/900",
      frameNumber: 9,
      rollId: maraRoll.id,
    },
  });

  await prisma.post.create({
    data: {
      userId: theo.id,
      text: "Three years ago today I moved to this city with two suitcases and no plan. Still figuring it out, but grateful for everyone who's been along for it.",
    },
  });

  const filmClub = await prisma.community.upsert({
    where: { slug: "filmclub" },
    update: {},
    create: {
      slug: "filmclub",
      name: "#FilmClub",
      description: "Film photography, gear talk, and developing tips. Digital-only shots go to #CityLife instead.",
    },
  });

  const cityLife = await prisma.community.upsert({
    where: { slug: "citylife" },
    update: {},
    create: {
      slug: "citylife",
      name: "#CityLife",
      description: "Street shots and stories from wherever you are.",
    },
  });

  for (const [user, community] of [
    [you, filmClub],
    [you, cityLife],
    [theo, filmClub],
    [nadia, filmClub],
  ] as const) {
    await prisma.communityMembership.upsert({
      where: { userId_communityId: { userId: user.id, communityId: community.id } },
      update: {},
      create: { userId: user.id, communityId: community.id },
    });
  }

  const filmClubPost = await prisma.post.create({
    data: {
      userId: theo.id,
      communityId: filmClub.id,
      text: "Anyone shot Portra 400 in low light? Curious how it handles indoor bars.",
    },
  });

  await prisma.helpfulMark.create({
    data: { userId: nadia.id, postId: filmClubPost.id },
  });

  console.log("Seeded users (all passwords: password123):");
  console.log("- you@example.com");
  console.log("- mara@example.com");
  console.log("- theo@example.com");
  console.log("- nadia@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
