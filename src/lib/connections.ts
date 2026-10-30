import { prisma } from "./prisma";

// IDs of everyone the user is connected to (accepted, either direction).
export async function connectedIds(userId: string): Promise<string[]> {
  const rows = await prisma.proConnection.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export async function connectionBetween(a: string, b: string) {
  return prisma.proConnection.findFirst({
    where: { OR: [{ requesterId: a, addresseeId: b }, { requesterId: b, addresseeId: a }] },
  });
}
