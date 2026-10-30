import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clean, fail, guardWrite, readJson, sessionUser, unauthorized, userSelect } from "@/lib/hub";
import { blockedUserIds } from "@/lib/blocks";

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"];

// GET ?q=&mine=1  -> open jobs newest first (mine=1: jobs you posted, open or not)
export async function GET(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const mine = url.searchParams.get("mine") === "1";
  const blocked = await blockedUserIds(me.id);

  const jobs = await prisma.job.findMany({
    where: {
      ...(mine ? { posterId: me.id } : { open: true, posterId: { notIn: blocked } }),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      poster: { select: userSelect },
      company: { select: { slug: true, name: true } },
      applications: { select: { userId: true } },
    },
  });

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      companyName: j.companyName,
      company: j.company,
      location: j.location,
      jobType: j.jobType,
      description: j.description,
      open: j.open,
      createdAt: j.createdAt,
      poster: j.poster,
      applied: j.applications.some((a) => a.userId === me.id),
      applicantCount: j.posterId === me.id ? j.applications.length : null,
      isMine: j.posterId === me.id,
    })),
  });
}

export async function POST(req: Request) {
  const me = await sessionUser();
  if (!me) return unauthorized();
  const guard = await guardWrite(me.id);
  if (guard) return guard;

  const b = await readJson(req);
  const title = clean(b.title, 120);
  const description = clean(b.description, 5000);
  let companyName = clean(b.companyName, 120);
  let companyId: string | null = null;

  if (typeof b.companyId === "string" && b.companyId) {
    const company = await prisma.company.findUnique({ where: { id: b.companyId } });
    if (!company || company.ownerId !== me.id) return fail("not_company_owner", 403);
    companyId = company.id;
    companyName = company.name;
  }
  if (!title || !description || !companyName) return fail("missing_fields");

  const jobType = JOB_TYPES.includes(String(b.jobType)) ? String(b.jobType) : "Full-time";
  const job = await prisma.job.create({
    data: { posterId: me.id, companyId, companyName, title, description, jobType, location: clean(b.location, 100) || null },
  });
  return NextResponse.json({ job });
}
