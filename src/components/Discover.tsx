"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AppShell from "./AppShell";
import PostGrid, { GridPost } from "./PostGrid";
import { GridSkeleton } from "./Skeletons";

export default function Discover() {
  const [posts, setPosts] = useState<GridPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setPosts(d.posts || []);
        setCursor(d.nextCursor ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function more() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const d = await (await fetch(`/api/discover?cursor=${encodeURIComponent(cursor)}`)).json();
      setPosts((prev) => [...prev, ...(d.posts || [])]);
      setCursor(d.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  const patch = useCallback((id: string, p: Partial<GridPost>) => {
    setPosts((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }, []);

  return (
    <AppShell active="discover">
      <div className="ap-shell ig-page-narrow">
        <div className="feed-greeting">
          <div>
            <p className="eyebrow">Explore</p>
            <h1>Discover.</h1>
          </div>
          <Link href="/search" className="ig-round-btn" aria-label="Search people">
            <Search size={19} />
          </Link>
        </div>
        <p className="ig-page-sub">Fresh photos from across Emerge.</p>

        {loading && <GridSkeleton />}
        {error && <div className="ap-loading">Couldn't load Discover. Check the database is up to date and try again.</div>}
        {!loading && !error && posts.length === 0 && (
          <div className="ap-loading">No photo posts from other people yet. Reels live in the Reels tab.</div>
        )}
        <PostGrid posts={posts} onPatch={patch} />
        {cursor && (
          <button className="ap-load-more" onClick={more} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </AppShell>
  );
}
