// Single place for the facts search engines and link previews need.
//
// SITE_URL is deliberately NOT read from NEXTAUTH_URL: that variable is for
// login redirects and can lag behind a rename. Set NEXT_PUBLIC_SITE_URL in
// Netlify only if the site moves to a custom domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://emect.netlify.app").replace(/\/$/, "");

export const SITE_NAME = "Emect";

export const SITE_TITLE = "Emect – Chronological, algorithm-free photo network";

export const SITE_DESCRIPTION =
  "Emect is a chronological, algorithm-free photo network with topic communities, stories, reels and messaging. No algorithm, no ads.";

// Link-preview card (WhatsApp, Slack, X, Facebook, LinkedIn). Lives in /public
// and is given as a full address, so it is right in development and production.
export const SITE_OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: "Emect: the chronological, algorithm-free photo network. No algorithm, no ads.",
};
