"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const MAX_FRAMES = 24;

type Frame = { id: string; imageUrl: string | null; frameNumber: number | null };
type RollEntry = { id: string; date: string; used: number; maxFrames: number; frames: Frame[] };

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function RollArchive() {
  const [rolls, setRolls] = useState<RollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rolls/archive")
      .then((res) => res.json())
      .then((data) => {
        setRolls(data.rolls || []);
        setCursor(data.nextCursor ?? null);
        setLoading(false);
      });
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/rolls/archive?cursor=${encodeURIComponent(cursor)}`);
      const data = await res.json();
      setRolls((prev) => [...prev, ...(data.rolls || [])]);
      setCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="ap-root">
      <div className="ap-shell">
        <Link href="/" className="ap-back-link">
          <ArrowLeft size={14} /> Back to feed
        </Link>
        <div className="ap-logo" style={{ margin: "10px 0 4px" }}><span>Your</span> rolls</div>
        <div className="ap-tagline" style={{ marginBottom: 20 }}>
          Every roll you've shot, developed or in progress
        </div>

        {loading && <div className="ap-loading">Loading archive…</div>}
        {!loading && rolls.length === 0 && (
          <div className="ap-loading">No rolls yet — post a photo to start one.</div>
        )}

        {rolls.map((roll) => {
          const isDone = roll.used >= roll.maxFrames;
          const emptySlots = Array.from({ length: roll.maxFrames - roll.frames.length });
          return (
            <div className="ap-archive-roll" key={roll.id}>
              <div className="ap-archive-head">
                <span className="ap-archive-date">{dateLabel(roll.date)}</span>
                <span className={"ap-archive-status" + (isDone ? " done" : " live")}>
                  {roll.used}/{roll.maxFrames} · {isDone ? "developed" : "developing"}
                </span>
              </div>
              <div className="ap-sheet-grid">
                {roll.frames.map((f) => (
                  <div className="ap-sheet-cell" key={f.id}>
                    {f.imageUrl && <img src={f.imageUrl} alt={`Frame ${f.frameNumber}`} />}
                  </div>
                ))}
                {emptySlots.map((_, i) => (
                  <div className="ap-sheet-cell empty" key={`empty-${i}`} />
                ))}
              </div>
            </div>
          );
        })}

        {!loading && cursor && (
          <button className="ap-load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
