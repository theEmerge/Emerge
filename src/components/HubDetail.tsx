"use client";
import Link from "next/link";
import AppShell from "./AppShell";
import { Hub } from "@/lib/hubs";

export default function HubDetail({ hub }: { hub: Hub }) {
  return (
    <AppShell active="hubs" hub={hub.id}>
      <div className="ap-shell ig-page-narrow hub-page">
        <div className="feed-greeting">
          <div>
            <p className="eyebrow">Planned hub{hub.modelledOn ? `, like ${hub.modelledOn}` : ""}</p>
            <h1>{hub.name}</h1>
          </div>
          <span className={"hub-pill " + hub.status}>Planned</span>
        </div>
        <p className="ig-page-sub">{hub.tagline} {hub.summary}</p>

        <div className="hub-banner">
          <b>Not built yet.</b> {hub.name} is on the roadmap ({hub.roadmapPhase.toLowerCase()}). The features below are
          starting proposals, not commitments, and can change as plans firm up.
        </div>

        <h2 className="hub-h2">Proposed features</h2>
        <ul className="hub-features">
          {hub.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <h2 className="hub-h2">How it fits Emerge</h2>
        <p className="hub-body">{hub.fit}</p>

        {hub.needs && (
          <>
            <h2 className="hub-h2">What it needs first</h2>
            <p className="hub-body">{hub.needs}</p>
          </>
        )}

        <div className="hub-actions">
          <Link href="/hubs" className="hub-link">See the full roadmap</Link>
          <Link href="/" className="hub-link">Back to Social Hub</Link>
        </div>
      </div>
    </AppShell>
  );
}
