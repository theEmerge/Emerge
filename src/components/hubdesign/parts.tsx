"use client"
// Shared building blocks for the Emerge hub design (ported from the Figma Make export).
import Link from "next/link"

export type IconName = "building" | "user" | "server" | "branch" | "trash" | "arrow" | "bell" | "briefcase" | "calendar" | "check" | "chevron" | "code" | "comment" | "controller" | "explore" | "fire" | "folder" | "grid" | "heart" | "home" | "link" | "message" | "more" | "people" | "plus" | "search" | "send" | "star" | "trend" | "sun" | "moon" | "image" | "bookmark" | "film" | "repeat" | "pin"

const iconPaths: Record<IconName, React.ReactNode> = {
  building: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  server: (
    <>
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <path d="M6 6h.01M6 18h.01" />
    </>
  ),
  branch: (
    <>
      <path d="M6 3v12" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  trash: <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18M10 12v2h4v-2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  code: (
    <>
      <path d="m8 9-3 3 3 3m8-6 3 3-3 3M14 5l-4 14" />
    </>
  ),
  comment: (
    <>
      <path d="M21 12a8.5 8.5 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 21l1.4-4A8.4 8.4 0 0 1 3 12a8.5 8.5 0 0 1 9-8.5 8.5 8.5 0 0 1 9 8.5Z" />
    </>
  ),
  controller: (
    <>
      <path d="M7.5 8h9a5 5 0 0 1 4.8 6.5l-1 3a2 2 0 0 1-3.3.8L14.5 16h-5L7 18.3a2 2 0 0 1-3.3-.8l-1-3A5 5 0 0 1 7.5 8Z" />
      <path d="M8 11v4m-2-2h4m6-1h.01m2 2h.01" />
    </>
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </>
  ),
  fire: (
    <path d="M12 22c4 0 7-3 7-7 0-3-2-6-5-9 0 3-2 4-3 5 0-3-1-6-3-9 0 5-3 7-3 12 0 4 3 8 7 8Z" />
  ),
  folder: <path d="M3 6h6l2 2h10v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
  ),
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
    </>
  ),
  message: (
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
  ),
  trend: <path d="m3 17 6-6 4 4 8-9m-5 0h5v5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="1.8" />
      <path d="m21 15-4.5-4.5L6 21" />
    </>
  ),
  bookmark: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z" />,
  film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 4l-2 5M14 4l-2 5M20 4l-2 5m-8 7 5-2.5L10 11Z" />
    </>
  ),
  repeat: <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" />,
  pin: (
    <>
      <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
}

export function Icon({
  name,
  size = 20,
  filled = false,
}: {
  name: IconName
  size?: number
  filled?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  )
}


// Photo avatar, or the person's initials when they have no photo.
export function HdAvatar({ name, src, small = false }: { name: string; src?: string | null; small?: boolean }) {
  const cls = small ? "hd-avatar hd-avatar-small" : "hd-avatar"
  if (src) return <img className={cls} src={src} alt={name} />
  const initials = (name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
  return <em className={cls + " hd-avatar-fallback"} role="img" aria-label={name}>{initials}</em>
}

export function Brand() {
  return (
    <Link href="/" className="hd-brand" aria-label="Emerge home">
      <span className="hd-brand-mark">e</span>
      <span className="hd-brand-name">emerge</span>
    </Link>
  )
}

export function Stat({ label, value, note, icon }: { label: string; value: string; note?: string; icon: IconName }) {
  return (
    <div className="hd-stat-card">
      <span className="hd-stat-icon"><Icon name={icon} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {note && <small>{note}</small>}
    </div>
  )
}
