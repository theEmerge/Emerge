"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "./AppShell";
import PostGrid, { GridPost } from "./PostGrid";
import { GridSkeleton } from "./Skeletons";

export default function Saved() {
  const [posts, setPosts] = useState<GridPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/saved")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .finally(() => setLoading(false));
  }, []);

  // Un-saving removes it from the shelf straight away.
  const patch = useCallback((id: string, p: Partial<GridPost>) => {
    setPosts((prev) =>
      p.saved === false ? prev.filter((x) => x.id !== id) : prev.map((x) => (x.id === id ? { ...x, ...p } : x))
    );
  }, []);

  return (
    <AppShell active="saved">
      <div className="ap-shell ig-page-narrow">
        <div className="feed-greeting">
          <div>
            <p className="eyebrow">Only you can see this</p>
            <h1>Saved.</h1>
          </div>
        </div>
        <p className="ig-page-sub">Posts and reels you've bookmarked, newest save first.</p>

        {loading && <GridSkeleton />}
        {!loading && posts.length === 0 && (
          <div className="ap-loading">Nothing saved yet. Tap the bookmark on any post to keep it here.</div>
        )}
        <PostGrid posts={posts} onPatch={patch} />
      </div>
    </AppShell>
  );
}
