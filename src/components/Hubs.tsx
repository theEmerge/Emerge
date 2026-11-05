"use client";
import Link from "next/link";
import AppShell from "./AppShell";
import { HUBS, PRINCIPLES, ROADMAP, SHARED_EVERYWHERE } from "@/lib/hubs";

export default function Hubs() {
  return (
    <AppShell active="hubs" hub="social">
      <div className="ap-shell ig-page-narrow hub-page">
        <div className="feed-greeting">
          <div>
            <p className="eyebrow">One platform. Many windows.</p>
            <h1>Everything online, in one place.</h1>
          </div>
        </div>
        <p className="ig-page-sub">
          Emerge is one platform with several windows, called hubs. Each serves a different part of digital life, and all
          of them share a single account, profile and inbox.
        </p>

        <div className="hub-shared">
          <b>Shared in every hub</b>
          <span>{SHARED_EVERYWHERE.join(", ")}</span>
        </div>

        <div className="hub-grid">
          {HUBS.map((h) => (
            <Link key={h.id} href={h.href} className="hub-card">
              <div className="hub-card-head">
                <h2>{h.name}</h2>
                <span className={"hub-pill " + h.status}>{h.status === "live" ? "Live" : "Planned"}</span>
              </div>
              <p className="hub-card-sum">{h.summary}</p>
            </Link>
          ))}
        </div>

        <h2 className="hub-h2">What is not built yet</h2>
        <p className="ig-page-sub">Parts of the plan that this release leaves for later, so nothing is a surprise.</p>
        {HUBS.filter((h) => h.notYet.length > 0).map((h) => (
          <div key={h.id} className="hub-notyet">
            <b>{h.name}</b>
            <ul>
              {h.notYet.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ))}

        <h2 className="hub-h2">What stays the same in every hub</h2>
        <ul className="hub-principles">
          {PRINCIPLES.map((p) => (
            <li key={p.title}>
              <b>{p.title}.</b> {p.body}
            </li>
          ))}
        </ul>

        <h2 className="hub-h2">Where Emerge is</h2>
        <ol className="hub-roadmap">
          {ROADMAP.map((r, i) => (
            <li key={r.phase} className={i < 5 ? "now" : ""}>
              <b>{r.phase}</b>
              <span>{r.focus}</span>
              <em>{r.outcome}</em>
            </li>
          ))}
        </ol>
        <p className="hub-note">Phases are in order of dependency, not dates.</p>
      </div>
    </AppShell>
  );
}
