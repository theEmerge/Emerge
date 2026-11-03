import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyEmailOtp } from "@/lib/otp";
import { DUMMY_HASH } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  // Sessions last 7 days (NextAuth default is 30) and are refreshed once a day.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Login code", type: "text" },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string") return null;
        const email = credentials.email.trim();
        if (!email || !credentials.password || email.length > 254 || credentials.password.length > 1000) return null;
        // Per-account limit: stops password guessing on one account no matter
        // which IPs it comes from, without punishing everyone sharing an IP.
        const { success } = await checkRateLimit(`login:${email.toLowerCase()}`, "login");
        if (!success) throw new Error("RATE_LIMITED");
        const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
        // Always run one bcrypt comparison, even for unknown emails, so
        // response time doesn't reveal which emails have accounts.
        const valid = await bcrypt.compare(credentials.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        // Second step of login: the 6-digit code emailed by /api/login/start.
        const result = await verifyEmailOtp(user.id, String(credentials.code ?? "").trim());
        if (result.status === "invalid") throw new Error("OTP_INVALID");
        if (result.status === "locked") throw new Error("OTP_LOCKED");
        if (result.status === "expired") throw new Error("OTP_EXPIRED");
        // Getting the code proves they own the inbox, so mark the email verified.
        if (!user.emailVerifiedAt) {
          await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
        }
        return { id: user.id, email: user.email, name: user.name, handle: user.handle, avatarUrl: user.avatarUrl };
      },
    }),
  ],
  callbacks: {
    // trigger === "update" fires when the client calls the update() function
    // from useSession() - used right after a profile-photo change so the
    // sidebar/composer avatar reflects it immediately instead of waiting
    // for the next login (JWT sessions don't otherwise re-read the DB).
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.handle = user.handle;
        token.avatarUrl = user.avatarUrl ?? null;
      }
      // The client can call update() after editing its profile, but whatever it
      // sends is NOT trusted: the new values are re-read from the database for
      // the signed-in user, so a tampered update() can't change who the token says you are.
      if (trigger === "update" && typeof token.id === "string") {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { name: true, handle: true, avatarUrl: true },
        });
        if (fresh) {
          token.name = fresh.name;
          token.handle = fresh.handle;
          token.avatarUrl = fresh.avatarUrl ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.handle = token.handle;
        session.user.avatarUrl = token.avatarUrl ?? null;
      }
      return session;
    },
  },
};
