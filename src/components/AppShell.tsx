"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Home, Compass, Clapperboard, Send, Bell, Bookmark, PlusSquare, UserRound, LogOut, Settings } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { useForceDarkInGame } from "@/lib/useHub";
import Avatar from "./Avatar";
import NewPostChooser from "./NewPostChooser";
import HubSwitcher from "./HubSwitcher";
import HubShell, { type ShellHub } from "./hubdesign/HubShell";
import type { IconName } from "./hubdesign/parts";
import { hubQuery, hubById, type HubId } from "@/lib/hubs";

// Survives navigations (module scope) so the badges don't flicker to 0 and refetch.
let unreadCache: Record<string, { at: number; messages: number; notifications: number }> = {};

type Tab = "home" | "discover" | "search" | "reels" | "messages" | "notifications" | "saved" | "profile" | "hubs";

type HubNavItem = { key: string; label: string; href: string; icon: IconName; exact?: boolean; prefix?: string };

// Each hub gets its own navigation; Messages and Notifications stay shared.
function hubNavFor(hub: HubId, handle?: string): HubNavItem[] {
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
export default function AppShell({ active, hub: hubProp, children }: { active: Tab; hub?: HubId; children: React.ReactNode }) {
  // Messages and Notifications are separate per hub: those pages are opened
  // with ?hub=... and pass it down here, so each hub has its own inbox.
  const hub: HubId = hubProp ?? "social";
  const hq = hubQuery(hub);
  useForceDarkInGame(hub === "game");
  const { data: session } = useSession();
  const router = useRouter();
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

  function goProfile() {
    if (session?.user?.handle) router.push(`/u/${session.user.handle}`);
  }

  // The Search page is part of Discover, so Discover stays highlighted there.
  const isActive = (key: Tab) => active === key || (key === "discover" && active === "search");
  const sw = (key: Tab) => (isActive(key) ? 2.6 : 1.8);

  const items: { key: Tab; label: string; icon: React.ReactNode; badge?: number; onClick: () => void }[] = [
    { key: "home", label: "Home", icon: <Home size={22} strokeWidth={sw("home")} />, onClick: () => router.push("/") },
    { key: "discover", label: "Discover", icon: <Compass size={22} strokeWidth={sw("discover")} />, onClick: () => router.push("/discover") },
    { key: "reels", label: "Reels", icon: <Clapperboard size={22} strokeWidth={sw("reels")} />, onClick: () => router.push("/reels") },
    { key: "notifications", label: "Notifications", icon: <Bell size={22} strokeWidth={sw("notifications")} fill={active === "notifications" ? "currentColor" : "none"} />, badge: unreadNotifs, onClick: () => router.push(`/notifications${hq}`) },
    { key: "messages", label: "Messages", icon: <Send size={22} strokeWidth={sw("messages")} />, badge: unreadMessages, onClick: () => router.push(`/messages${hq}`) },
    { key: "saved", label: "Saved", icon: <Bookmark size={22} strokeWidth={sw("saved")} fill={active === "saved" ? "currentColor" : "none"} />, onClick: () => router.push("/saved") },
    { key: "profile", label: "Profile", icon: <UserRound size={22} strokeWidth={sw("profile")} />, onClick: goProfile },
  ];

  // Desktop: Profile lives in the card at the bottom of the sidebar, so it
  // isn't repeated in the nav list.
  const sidebarItems = items.filter((it) => it.key !== "profile");

  // Mobile's bottom bar has room for 5 slots. Messages and Notifications
  // already have icons in the top bar, and Saved sits on the Profile page's
  // tabs and in the desktop sidebar.
  const bottomItems = items.filter((it) => ["home", "discover", "reels", "profile"].includes(it.key));

  // Outside the Social Hub the rail and tab bar show that hub's own pages.
  const hubNav = hub === "social" ? null : hubNavFor(hub, session?.user?.handle);
  const hubActive = (it: HubNavItem) =>
    it.exact ? pathname === it.href || (!!it.prefix && pathname.startsWith(it.prefix)) : pathname.startsWith(it.prefix || it.href);

  if (hubNav) {
    return (
      <HubShell
        hub={hub as ShellHub}
        nav={hubNav.map((it) => ({ key: it.key, label: it.label, href: it.href, icon: it.icon, active: hubActive(it) }))}
        unreadMessages={unreadMessages}
        unreadNotifs={unreadNotifs}
        messagesHref={`/messages${hq}`}
        notificationsHref={`/notifications${hq}`}
        user={{ name: session?.user?.name || "", handle: session?.user?.handle || "", avatarUrl: session?.user?.avatarUrl }}
      >
        {children}
      </HubShell>
    );
  }

  return (
    <div className="ig-shell" data-hub={hub}>
      <header className="ig-topbar">
        <Link href="/" className="ig-topbar-logo">
          <Logo width={150} />
        </Link>
        <div className="ig-topbar-icons">
          <HubSwitcher current={hub} variant="icon" />
          <button className="ig-topbar-icon" onClick={() => router.push(`/notifications${hq}`)} title="Notifications">
            <Bell size={22} strokeWidth={1.8} fill={active === "notifications" ? "currentColor" : "none"} />
            {unreadNotifs > 0 && <span className="ig-badge" />}
          </button>
          <button className="ig-topbar-icon" onClick={() => router.push(`/messages${hq}`)} title="Messages">
            <Send size={22} strokeWidth={1.8} />
            {unreadMessages > 0 && <span className="ig-badge" />}
          </button>
          <ThemeToggle variant="icon" />
        </div>
      </header>

      <nav className="ig-sidebar">
        <Link href="/" className="ig-sidebar-logo">
          <Logo width={172} />
        </Link>
        <HubSwitcher current={hub} variant="sidebar" />
        <div className="ig-nav-items">
          {sidebarItems.map((it) => (
            <button key={it.key} className={"ig-nav-item" + (isActive(it.key) ? " active" : "")} onClick={it.onClick}>
              <span className="ig-nav-icon">
                {it.icon}
                {!!it.badge && <span className="ig-badge" />}
              </span>
              <span className="ig-nav-label">{it.label}</span>
            </button>
          ))}
        </div>
        <button className="ig-create-btn" onClick={() => setShowChooser(true)}>
          <PlusSquare size={18} strokeWidth={2} /> Create post
        </button>
        <div className="ig-sidebar-spacer" />
        <ThemeToggle />
        <div className="ig-profile-foot">
          <button className="ig-profile-foot-main" onClick={goProfile} aria-label="Your profile">
            <Avatar name={session?.user?.name || "?"} src={session?.user?.avatarUrl} size={40} />
            <span className="ig-profile-foot-text">
              <span className="ig-profile-foot-name">{session?.user?.name}</span>
              <span className="ig-profile-foot-handle">@{session?.user?.handle}</span>
            </span>
          </button>
          <button className="ig-profile-foot-out" onClick={() => router.push("/settings")} title="Settings" aria-label="Settings">
            <Settings size={18} strokeWidth={1.8} />
          </button>
          <button className="ig-profile-foot-out" onClick={() => signOut({ callbackUrl: "/login" })} title="Log out" aria-label="Log out">
            <LogOut size={18} strokeWidth={1.8} />
          </button>
        </div>
      </nav>

      <main className="ig-main">{children}</main>

      <nav className="ig-bottombar">
        {bottomItems.slice(0, 2).map((it) => (
          <button
            key={it.key}
            className={"ig-bottombar-item" + (isActive(it.key) ? " active" : "")}
            onClick={it.onClick}
            aria-label={it.label}
          >
            {it.icon}
          </button>
        ))}
        <button className="ig-bottombar-item" onClick={() => setShowChooser(true)} aria-label="New post">
          <PlusSquare size={22} strokeWidth={1.8} />
        </button>
        {bottomItems.slice(2).map((it) => (
          <button
            key={it.key}
            className={"ig-bottombar-item" + (isActive(it.key) ? " active" : "")}
            onClick={it.onClick}
            aria-label={it.label}
          >
            {it.icon}
          </button>
        ))}
      </nav>
      {showChooser && <NewPostChooser onClose={() => setShowChooser(false)} />}
    </div>
  );
}
