"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import "./hubdesign.css"
import "./hubdesign-extras.css"
import { Brand, HdAvatar, Icon, type IconName } from "./parts"

export type ShellHub = "connection" | "game" | "developer"
export type ShellNavItem = { key: string; label: string; href: string; icon: IconName; active: boolean }

// Same copy as the Figma mock; "theme" is the Figma name for each hub's palette.
const META: Record<ShellHub, { theme: string; label: string; short: string; icon: IconName; eyebrow: string; href: string }> = {
  connection: { theme: "professional", label: "Professional Hub", short: "professional", icon: "briefcase", eyebrow: "Build your next chapter", href: "/connection" },
  game: { theme: "game", label: "Game Hub", short: "gaming", icon: "controller", eyebrow: "Your party is online", href: "/game" },
  developer: { theme: "developer", label: "Developer Hub", short: "developer", icon: "code", eyebrow: "Ship what matters", href: "/developer" },
}
const ORDER: ShellHub[] = ["connection", "game", "developer"]

export default function HubShell({
  hub, nav, unreadMessages, unreadNotifs, messagesHref, notificationsHref, user, children,
}: {
  hub: ShellHub
  nav: ShellNavItem[]
  unreadMessages: number
  unreadNotifs: number
  messagesHref: string
  notificationsHref: string
  user: { name: string; handle: string; avatarUrl?: string | null }
  children: React.ReactNode
}) {
  const router = useRouter()
  const meta = META[hub]
  const searchRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState(false)
  const profileHref = `/u/${user.handle}`

  // ⌘K / Ctrl+K focuses search, like the hint in the design.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === "Escape") setMenu(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className={`hd-app hd-theme-${meta.theme}`}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&family=Space+Mono:wght@400;700&display=swap" />

      <aside className="hd-sidebar">
        <Brand />
        <div className="hd-hub-switcher">
          <p className="hd-micro-label">Current space</p>
          {ORDER.map((id) => (
            <Link key={id} href={META[id].href} className={`hd-hub-option ${hub === id ? "hd-active" : ""}`} aria-current={hub === id ? "page" : undefined}>
              <span className="hd-hub-option-icon"><Icon name={META[id].icon} size={17} /></span>
              <span>{META[id].label}</span>
              {hub === id && <span className="hd-active-pip" />}
            </Link>
          ))}
          <Link href="/" className="hd-hub-option">
            <span className="hd-hub-option-icon"><Icon name="home" size={17} /></span>
            <span>Social Hub</span>
          </Link>
        </div>
        <nav className="hd-side-nav" key={hub}>
          <p className="hd-micro-label">Workspace</p>
          {nav.map((it, index) => (
            <Link key={it.key} href={it.href} className={`hd-nav-item ${it.active ? "hd-active" : ""}`}>
              <Icon name={it.icon} filled={index === 0 && it.active} />
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="hd-sidebar-bottom">
          <Link href={messagesHref} className="hd-nav-item">
            <Icon name="message" />
            <span>Messages</span>
            {unreadMessages > 0 && <span className="hd-unread-dot" />}
          </Link>
          <div className="hd-profile-row">
            <Link href={profileHref} style={{ display: "contents" }}>
              <HdAvatar name={user.name} src={user.avatarUrl} />
              <div>
                <strong>{user.name}</strong>
                <span>@{user.handle}</span>
              </div>
            </Link>
            <button className="hd-icon-plain" aria-label="Profile options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Icon name="more" />
            </button>
            {menu && (
              <div className="hd-menu" role="menu" onMouseLeave={() => setMenu(false)}>
                <Link href={profileHref} role="menuitem">Your profile</Link>
                <Link href="/settings" role="menuitem">Settings</Link>
                <button role="menuitem" onClick={() => signOut({ callbackUrl: "/login" })}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <header className="hd-mobile-header">
        <Brand />
        <div className="hd-mobile-hubs">
          {ORDER.map((id) => (
            <Link key={id} href={META[id].href} className={hub === id ? "hd-active" : ""} aria-label={META[id].label}>
              <Icon name={META[id].icon} size={18} />
            </Link>
          ))}
        </div>
      </header>

      <main className="hd-app-main">
        <header className="hd-page-header">
          <div>
            <p className="hd-eyebrow">{meta.eyebrow}</p>
            <h1>{meta.label}</h1>
          </div>
          <div className="hd-header-actions">
            <form
              className="hd-search-box"
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                const q = new FormData(e.currentTarget).get("q")
                router.push(`/search${typeof q === "string" && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)
              }}
            >
              <Icon name="search" size={18} />
              <input ref={searchRef} name="q" aria-label="Search" placeholder={`Search ${meta.short}`} autoComplete="off" />
              <kbd>⌘ K</kbd>
            </form>
            <Link href={notificationsHref} className="hd-circle-button" aria-label="Notifications">
              <Icon name="bell" />
              {unreadNotifs > 0 && <span className="hd-notification-dot" />}
            </Link>
            <Link href={profileHref} aria-label="Your profile" style={{ display: "contents" }}>
              <HdAvatar name={user.name} src={user.avatarUrl} />
            </Link>
          </div>
        </header>
        <div className="hd-hub-content">{children}</div>
      </main>

      <nav className="hd-bottombar" aria-label="Hub navigation">
        {nav.map((it) => (
          <Link key={it.key} href={it.href} className={it.active ? "hd-active" : ""} aria-label={it.label}>
            <Icon name={it.icon} size={21} />
          </Link>
        ))}
        <Link href={messagesHref} aria-label="Messages">
          <Icon name="message" size={21} />
          {unreadMessages > 0 && <span className="hd-unread-dot" />}
        </Link>
      </nav>
    </div>
  )
}
