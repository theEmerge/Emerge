"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForceDarkInGame } from "@/lib/useHub";
import NewPostChooser from "./NewPostChooser";
import HubShell, { type ShellHub } from "./hubdesign/HubShell";
import type { IconName } from "./hubdesign/parts";
import { hubQuery, type HubId } from "@/lib/hubs";

// Survives navigations (module scope) so the badges don't flicker to 0 and refetch.
let unreadCache: Record<string, { at: number; messages: number; notifications: number }> = {};

type Tab = "home" | "discover" | "search" | "reels" | "messages" | "notifications" | "saved" | "profile" | "hubs";

type HubNavItem = { key: string; label: string; href: string; icon: IconName; exact?: boolean; prefix?: string; match?: string[] };

// Each hub gets its own navigation; Messages and Notifications stay shared.
function hubNavFor(hub: HubId, handle?: string): HubNavItem[] {
  if (hub === "social") {
    return [
      { key: "home", label: "Home", href: "/", icon: "home", exact: true },
      { key: "discover", label: "Discover", href: "/discover", icon: "explore", match: ["/discover", "/search"] },
      { key: "reels", label: "Reels", href: "/reels", icon: "film" },
      { key: "saved", label: "Saved", href: "/saved", icon: "bookmark" },
      { key: "hubs", label: "All hubs", href: "/hubs", icon: "grid" },
    ];
  }
  if (hub === "connection") {
    return [
      { key: "feed", label: "Feed", href: "/connection", icon: "grid", exact: true },
      { key: "network", label: "Network", href: "/connection/network", icon: "people" },
      { key: "jobs", label: "Jobs", href: "/connection/jobs", icon: "briefcase" },
      { key: "events", label: "Events", href: "/connection/events", icon: "calendar" },
      { key: "companies", label: "Companies", href: "/connection/companies", icon: "building" },
      { key: "me", label: "My profile", href: `/connection/in/${handle ?? ""}`, icon: "user", prefix: "/connection/in/" },
    ];
  }
  if (hub === "game") {
    return [
      { key: "servers", label: "Servers", href: "/game", icon: "server", exact: true, prefix: "/game/s/" },
      { key: "party", label: "Find a party", href: "/game/party", icon: "people" },
    ];
  }
  if (hub === "developer") {
    return [
      { key: "repos", label: "Repositories", href: "/developer", icon: "branch", exact: true, prefix: "/developer/r/" },
      { key: "me", label: "My profile", href: `/developer/u/${handle ?? ""}`, icon: "code", prefix: "/developer/u/" },
    ];
  }
  return [];
}

// Shared chrome for every page: top bar, sidebar, mobile tab bar.
// Each hub gets its own navigation and colours (data-hub); Messages and
// Notifications stay shared and keep the hub you came from.
//
// Home only ever shows people you follow (still the "no algorithm"
// design) - Search is the way to find and open ANY account's profile,
// where their posts are visible regardless of follow status.
export default function AppShell({ hub: hubProp, children }: { active: Tab; hub?: HubId; children: React.ReactNode }) {
  // Messages and Notifications are separate per hub: those pages are opened
  // with ?hub=... and pass it down here, so each hub has its own inbox.
  const hub: HubId = hubProp ?? "social";
  const hq = hubQuery(hub);
  useForceDarkInGame(hub === "game");
  const { data: session } = useSession();
  const pathname = usePathname() || "";
  const [unreadMessages, setUnreadMessages] = useState(unreadCache[hub]?.messages ?? 0);
  const [unreadNotifs, setUnreadNotifs] = useState(unreadCache[hub]?.notifications ?? 0);
  const [showChooser, setShowChooser] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      // No point asking while the tab is in the background.
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/unread?hub=${hub}`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        const entry = { at: Date.now(), messages: data.messages || 0, notifications: data.notifications || 0 };
        unreadCache[hub] = entry;
        setUnreadMessages(entry.messages);
        setUnreadNotifs(entry.notifications);
      } catch {
        /* best-effort - a failed poll just leaves the badges as-is */
      }
    }
    // Every page mounts its own AppShell, so without this each navigation
    // re-fetched the counts immediately.
    const cached = unreadCache[hub];
    if (!cached || Date.now() - cached.at > 20000) poll();
    const id = setInterval(poll, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hub]);

  // Every hub, Social included, uses the same shell with its own navigation.
  const hubNav = hubNavFor(hub, session?.user?.handle);
  const hubActive = (it: HubNavItem) =>
    it.match ? it.match.some((m) => pathname.startsWith(m)) :
    it.exact ? pathname === it.href || (!!it.prefix && pathname.startsWith(it.prefix)) : pathname.startsWith(it.prefix || it.href);

  return (
      <HubShell
        hub={hub as ShellHub}
        nav={hubNav.map((it) => ({ key: it.key, label: it.label, href: it.href, icon: it.icon, active: hubActive(it) }))}
        unreadMessages={unreadMessages}
        unreadNotifs={unreadNotifs}
        messagesHref={`/messages${hq}`}
        notificationsHref={`/notifications${hq}`}
        user={{ name: session?.user?.name || "", handle: session?.user?.handle || "", avatarUrl: session?.user?.avatarUrl }}
        onCreate={hub === "social" ? () => setShowChooser(true) : undefined}
      >
        {children}
        {showChooser && <NewPostChooser onClose={() => setShowChooser(false)} />}
      </HubShell>
  );
}
