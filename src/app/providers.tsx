"use client";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode } from "react";
import ThemeProvider from "@/components/ThemeProvider";

export default function Providers({ children, session }: { children: ReactNode; session: Session | null }) {
  return (
    // refetchOnWindowFocus off: every tab switch used to fire an extra
    // /api/auth/session request.
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  );
}
