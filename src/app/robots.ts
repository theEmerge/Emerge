import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Everything except the public front page and sign-up sits behind a login, so
// crawlers would only ever hit a redirect there. Listing those paths keeps
// Googlebot from wasting visits on them. Static assets (/_next/...) are NOT
// blocked, because Google needs the CSS and JS to render the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/register"],
        disallow: [
          "/api/",
          "/admin",
          "/messages",
          "/notifications",
          "/settings",
          "/saved",
          "/archive",
          "/reels",
          "/discover",
          "/search",
          "/u/",
          "/connection",
          "/developer",
          "/game",
          "/hubs",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/verify-otp",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
