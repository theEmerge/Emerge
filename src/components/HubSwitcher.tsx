"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid, Home, Briefcase, Gamepad2, Code2 } from "lucide-react";
import { HUBS, hubById, HubId } from "@/lib/hubs";

// One switcher, two presentations: a row under the logo on desktop, and a
// grid button in the mobile top bar that opens the same list as a sheet.
export default function HubSwitcher({ current, variant = "sidebar" }: { current: HubId; variant?: "sidebar" | "icon" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hub = hubById(current);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={"hub-switch hub-switch-" + variant} ref={ref}>
      {variant === "sidebar" ? (
        <button className="hub-switch-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
          <span className="hub-switch-text">
            <span className="hub-switch-label">Hub</span>
            <span className="hub-switch-name">{hub.name}</span>
          </span>
          <ChevronDown size={16} strokeWidth={2} className={open ? "hub-chev open" : "hub-chev"} />
        </button>
      ) : (
        <button className="ig-topbar-icon" onClick={() => setOpen((o) => !o)} aria-label="Switch hub" aria-expanded={open} title="Hubs">
          <LayoutGrid size={22} strokeWidth={1.8} />
        </button>
      )}

      {open && (
        <div className="hub-menu" role="menu">
          {HUBS.map((h) => (
            <Link
              key={h.id}
              href={h.href}
              role="menuitem"
              className={"hub-menu-item" + (h.id === current ? " current" : "")}
              onClick={() => setOpen(false)}
            >
              <span className="hub-menu-main">
                <span className="hub-menu-name">{h.name}</span>
                <span className="hub-menu-tag">{h.tagline}</span>
              </span>
              <span className={"hub-pill " + h.status}>{h.status === "live" ? "Live" : "Planned"}</span>
            </Link>
          ))}
          <Link href="/hubs" role="menuitem" className="hub-menu-all" onClick={() => setOpen(false)}>
            Platform overview and roadmap
          </Link>
        </div>
      )}
    </div>
  );
}


const LIST_ICONS = { social: Home, connection: Briefcase, game: Gamepad2, developer: Code2 } as const;
export const HUB_LABEL: Record<HubId, string> = { social: "Social Hub", connection: "Professional Hub", game: "Game Hub", developer: "Developer Hub" };

// "Current space": every hub in one list, the active one highlighted.
export function HubList({ current }: { current: HubId }) {
  return (
    <div className="hub-list">
      <p className="hub-micro">Current space</p>
      {HUBS.map((h) => {
        const Icon = LIST_ICONS[h.id];
        const active = h.id === current;
        return (
          <Link key={h.id} href={h.href} className={"hub-list-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined}>
            <span className="hub-list-icon"><Icon size={16} strokeWidth={1.9} /></span>
            <span className="hub-list-name">{HUB_LABEL[h.id]}</span>
            {active && <span className="hub-list-pip" />}
          </Link>
        );
      })}
    </div>
  );
}
