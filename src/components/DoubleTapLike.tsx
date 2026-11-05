"use client";
import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";

// Double-tap / double-click on media = like (Instagram style). It only ever LIKES,
// never un-likes: the caller checks that the item isn't already liked.
//
// The first click is held back for a moment so a single tap can still do its normal job
// (for reels: play/pause) without firing when the person is actually double-tapping.
export function useKeyedDoubleTap(onDouble: (key: string) => void, onSingle?: (key: string) => void, delay = 260) {
  const last = useRef<{ key: string; t: number; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const double = useRef(onDouble);
  const single = useRef(onSingle);
  double.current = onDouble;
  single.current = onSingle;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback((e: MouseEvent, key: string) => {
    // buttons on top of the media (carousel arrows, mute...) keep their own behaviour
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    const now = Date.now();
    const l = last.current;
    if (l && l.key === key && now - l.t < delay && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 48) {
      last.current = null;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      double.current(key);
      return;
    }
    last.current = { key, t: now, x: e.clientX, y: e.clientY };
    if (single.current) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; last.current = null; single.current?.(key); }, delay);
    }
  }, [delay]);
}

// One item (a photo post): same thing without needing a key.
export function useDoubleTap(onDouble: () => void, onSingle?: () => void, delay = 260) {
  const tap = useKeyedDoubleTap(() => onDouble(), onSingle ? () => onSingle() : undefined, delay);
  return useCallback((e: MouseEvent) => tap(e, "x"), [tap]);
}

// Big white heart that pops in the middle of the media. Change `n` (any new number > 0)
// to play it again; the key restarts the CSS animation each time.
export function HeartBurst({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span key={n} className="ig-heart-burst" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="100" height="100" fill="currentColor">
        <path d="M12 21.2 10.6 20C5.4 15.3 2 12.2 2 8.4 2 5.3 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.3 22 8.4c0 3.8-3.4 6.9-8.6 11.6l-1.4 1.2Z" />
      </svg>
    </span>
  );
}
