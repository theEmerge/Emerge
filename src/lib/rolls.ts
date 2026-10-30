import { prisma } from "@/lib/prisma";

export function startOfDay(d: Date = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

// Finds today's roll for a user, creating it if this is their first frame
// or post of the day. A new calendar day always means a brand new roll -
// this is the "develops at midnight" mechanic, and it's just a date lookup,
// no cron job needed.
export async function getOrCreateTodayRoll(userId: string) {
  const date = startOfDay();
  let roll = await prisma.roll.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!roll) {
    roll = await prisma.roll.create({
      data: { userId, date, framesUsed: 0, maxFrames: 24 },
    });
  }
  return roll;
}

// Claims the next frame on today's roll. The daily cap is retired - this
// no longer throws ROLL_FULL or blocks on framesUsed < maxFrames. Rolls
// still exist purely as a grouping for the contact-sheet archive view
// (see /archive and RollArchive.tsx), so we keep incrementing framesUsed
// and stamping frameNumber, but it's just a running count now, not a gate.
export async function claimNextFrame(userId: string) {
  const roll = await getOrCreateTodayRoll(userId);

  const fresh = await prisma.roll.update({
    where: { id: roll.id },
    data: { framesUsed: { increment: 1 } },
  });

  return { rollId: roll.id, frameNumber: fresh.framesUsed, maxFrames: fresh.maxFrames };
}
