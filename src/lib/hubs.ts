// Single source of truth for the hubs described in the Emerge platform overview.
// The switcher, the /hubs overview and every /hubs/[slug] page read from here.

export type HubId = "social" | "connection" | "game" | "developer";
export type HubStatus = "live" | "planned";

export type Hub = {
  id: HubId;
  slug: string;
  name: string;
  status: HubStatus;
  modelledOn?: string;
  tagline: string;
  summary: string;
  href: string;
  features: string[];
  // Things from the platform overview that this release does not include yet.
  notYet: string[];
  fit: string;
  needs?: string;
  roadmapPhase: string;
};

export const HUBS: Hub[] = [
  {
    id: "social",
    slug: "social",
    name: "Social Hub",
    status: "live",
    tagline: "Chronological, algorithm-free photo and community feed.",
    summary: "The original Emerge: personal rolls and communities, with nothing ranked or boosted.",
    href: "/",
    features: [
      "Personal rolls capped at 24 frames a day",
      "Communities with their own chronological feed",
      "Stories, reels and direct and group messaging",
    ],
    notYet: [],
    fit: "The foundation every other hub reuses: login, profile, follow graph, messaging and notifications.",
    roadmapPhase: "Now",
  },
  {
    id: "connection",
    slug: "connection",
    name: "Connection Hub",
    status: "live",
    modelledOn: "LinkedIn",
    tagline: "A professional network without the engagement-bait feed.",
    summary: "Build a career identity, find work and meet people in your field.",
    href: "/connection",
    features: [
      "Professional profile: headline, experience, education, skills, portfolio link",
      "Connections, with mutual connections shown on every profile",
      "Job board with applications; message applicants from the Emerge inbox",
      "Company pages with their open roles",
      "Endorsements and written recommendations from connections",
      "Chronological professional feed with no ranking",
    ],
    notYet: [
      "Requesting a warm introduction through a mutual contact (mutual contacts are visible, but there is no intro request flow)",
      "Industry communities (Social Hub communities cover this for now)",
      "A dedicated search engine; people and job search use database queries",
    ],
    fit: "Your Emerge profile is the base of your professional profile. Connection Hub reuses messaging, notifications and blocking, and the no-algorithm rule applies here too, so reach is never bought or gamed.",
    needs: "A dedicated search engine for jobs and people instead of database queries.",
    roadmapPhase: "Then",
  },
  {
    id: "game",
    slug: "game",
    name: "Game Hub",
    status: "live",
    modelledOn: "Discord",
    tagline: "A gaming community space next to the rest of your Emerge life.",
    summary: "Servers, channels and a party finder for gaming groups and friends.",
    href: "/game",
    features: [
      "Servers with text channels, owner and admin roles, and invite codes",
      "Game presence: set what you are playing and see what people you follow are playing",
      "Party finder (LFG board) with slots and join or leave",
      "Chat that refreshes every few seconds",
    ],
    notYet: [
      "Voice and video rooms and screen sharing (these need WebRTC and a real-time layer)",
      "Instant message delivery (chat polls every few seconds today)",
      "Clips and highlights shared into the Social Hub",
      "Fine-grained permissions per channel",
    ],
    fit: "Reuses messaging, follows, blocking and notifications. Real-time voice and live chat need a real-time layer, since chat polls today.",
    needs: "WebSockets or a managed realtime service, plus WebRTC with a media server or hosted provider.",
    roadmapPhase: "Then",
  },
  {
    id: "developer",
    slug: "developer",
    name: "Developer Hub",
    status: "live",
    modelledOn: "GitHub",
    tagline: "A home for projects: host code, review it together and ship.",
    summary: "Your builder identity lives on the same profile as everything else.",
    href: "/developer",
    features: [
      "Repositories with a file browser, an in-browser editor, branches and commit history",
      "Pull requests with line diffs, review comments and merge",
      "Issues, plus a project board (To do, In progress, Done) per repo",
      "Releases with tags and notes",
      "Collaborators who can push and merge",
      "Developer profile: pinned projects and 90 days of contribution history",
    ],
    notYet: [
      "Real git: repositories live in the database, so there is no clone or push over git",
      "Organizations and teams mapped to Emerge communities",
      "Per-repo discussions, and line-level review comments",
      "Sharing builds and devlogs straight into the Social Hub",
    ],
    fit: "One identity for showing work, getting hired (Connection Hub) and hanging out (Game Hub).",
    needs: "A git hosting service with diffing is the next big build, which would replace the database-backed storage.",
    roadmapPhase: "Later",
  },
];

const HUB_IDS: HubId[] = ["social", "connection", "game", "developer"];
// Safe to call with anything (query strings, request bodies): unknown -> "social".
export function parseHub(v: unknown): HubId {
  return typeof v === "string" && (HUB_IDS as string[]).includes(v) ? (v as HubId) : "social";
}
// "?hub=connection" for non-social hubs, "" for social - used to keep Messages/Notifications inside a hub.
export const hubQuery = (hub: HubId) => (hub === "social" ? "" : `?hub=${hub}`);

export const hubBySlug = (slug: string) => HUBS.find((h) => h.slug === slug);
export const hubById = (id: HubId) => HUBS.find((h) => h.id === id)!;

export const SHARED_EVERYWHERE = ["Login", "Profile", "Followers", "Notifications", "Messaging", "Settings", "Theme"];

export const PRINCIPLES = [
  { title: "No manipulation", body: "Nothing is ranked, boosted or hidden by an algorithm. Order is chronological and rules are visible." },
  { title: "One identity", body: "The same handle, avatar, bio and followers carry across every hub." },
  { title: "Calm by design", body: "Limits and hidden vanity metrics keep the platform about people, not numbers." },
];

export const ROADMAP = [
  { phase: "Social Hub", focus: "Polish, stability, finish gaps: profile comments, community pages, infinite scroll, real-time chat", outcome: "A solid, trustworthy core everything else sits on" },
  { phase: "Platform foundation: built", focus: "Hub switcher, hub-aware shell, shared identity and inbox", outcome: "Emerge feels like one platform" },
  { phase: "Connection Hub: first release built", focus: "Professional profiles, connections, jobs, company pages, endorsements", outcome: "Next: intro requests and search" },
  { phase: "Game Hub: first release built", focus: "Servers, text channels, presence, party finder", outcome: "Next: real-time layer, then voice" },
  { phase: "Developer Hub: first release built", focus: "Repos, branches, pull requests, issues, releases, developer profiles", outcome: "Next: real git hosting, organizations" },
];
