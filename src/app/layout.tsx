import "./globals.css";
import type { Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Providers from "./providers";

// Self-hosted by next/font at build time: no render-blocking request to
// fonts.googleapis.com, no layout shift (size-adjusted fallback), and only
// the weights the UI actually uses.
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-body" });
const display = Manrope({ subsets: ["latin"], weight: ["700", "800"], display: "swap", variable: "--font-display" });

// Tints the phone's address bar / status area to match the app.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F3EF" },
    { media: "(prefers-color-scheme: dark)", color: "#171713" },
  ],
};

export const metadata = {
  title: "Emerge",
  description: "A chronological, algorithm-free photo network with topic communities.",
};

// Sets data-theme on <html> before the page paints, from localStorage or
// the OS preference if nothing's been chosen yet - avoids a flash of the
// wrong theme on load. ThemeProvider (client-side) just mirrors this into
// React state afterwards; it never decides the initial theme itself.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('emerge-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Handing the session to the client provider means the browser doesn't have
  // to make its own /api/auth/session round-trip before it knows who you are.
  const session = await getServerSession(authOptions);
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
