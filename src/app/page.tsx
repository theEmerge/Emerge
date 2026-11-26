import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Feed from "@/components/Feed";
import Landing from "@/components/Landing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_TITLE } from "@/lib/site";

// This is the one page search engines can read. Logged-out visitors get the
// public front page; logged-in members get their feed at the same address.
export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION, url: "/", images: [SITE_OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SITE_OG_IMAGE.url] },
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) return <Landing />;
  return <Feed />;
}
