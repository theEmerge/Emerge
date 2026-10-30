import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    handle: string;
    avatarUrl?: string | null;
  }
  interface Session {
    user: {
      id: string;
      handle: string;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    handle: string;
    avatarUrl?: string | null;
  }
}
