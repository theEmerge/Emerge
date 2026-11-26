import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";
import { deleteCloudinaryFiles } from "@/lib/cloudinaryCleanup";

// "Delete my account". Needs the current password (so a stolen session alone
// can't wipe an account). Database rows go in one step because the foreign
// keys cascade (see the cascade_user_data migration). Files at Cloudinary are
// deleted afterwards, best effort. A confirmation email is sent last.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = session.user.id;

  const limited = await checkRateLimit(`delacct:${id}`, "login");
  if (!limited.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { password, confirm } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || !password || confirm !== "DELETE") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, name: true, passwordHash: true, avatarUrl: true, bannerUrl: true },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "wrong_password" }, { status: 403 });
  }

  // Collect the files first; the rows that point to them disappear next.
  const [posts, postImages, stories] = await Promise.all([
    prisma.post.findMany({ where: { userId: id }, select: { imageUrl: true, videoUrl: true } }),
    prisma.postImage.findMany({ where: { post: { userId: id } }, select: { url: true } }),
    prisma.story.findMany({ where: { userId: id }, select: { imageUrl: true, videoUrl: true } }),
  ]);
  const urls = [
    user.avatarUrl, user.bannerUrl,
    ...posts.flatMap((p) => [p.imageUrl, p.videoUrl]),
    ...postImages.map((p) => p.url),
    ...stories.flatMap((s) => [s.imageUrl, s.videoUrl]),
  ];

  // Reports about this person keep no copy of their words once they are gone.
  await prisma.report.updateMany({ where: { targetUserId: id }, data: { snapshot: null, note: null } });
  await prisma.user.delete({ where: { id } });

  await deleteCloudinaryFiles(urls);

  await sendEmail({
    to: user.email,
    subject: "Your Emect account has been deleted",
    text:
      `Hi ${user.name},\n\n` +
      `Your Emect account and the content you shared (posts, stories, messages you sent, comments and profile) have been deleted.\n\n` +
      `Copies in our database backups are removed when those backups expire on their normal schedule.\n\n` +
      `If you didn't ask for this, reply to this email right away.`,
  });

  return NextResponse.json({ ok: true });
}
