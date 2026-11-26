import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only pages a logged-out visitor (and so a crawler) can actually open and
// that are meant to be found. Add public pages here as they are built.
// No lastModified on purpose: a made-up "changed today" date on every
// request teaches Google to ignore the field.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/register`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
