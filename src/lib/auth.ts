import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyEmailOtp } from "@/lib/otp";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
        if (!credentials?.email || !credentials?.password) return null;
        // Per-account limit: stops password guessing on one account no matter
        // which IPs it comes from, without punishing everyone sharing an IP.
        const { success } = await checkRateLimit(`login:${credentials.email.trim().toLowerCase()}`, "login");
        if (!success) throw new Error("RATE_LIMITED");
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

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
      if (trigger === "update") {
        if (session?.avatarUrl !== undefined) token.avatarUrl = session.avatarUrl;
        if (typeof session?.name === "string") token.name = session.name;
        if (typeof session?.handle === "string") token.handle = session.handle;
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
