"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Gif = { id: string; url: string; preview: string };

// Searches Giphy directly from the browser (their API is meant to be
// called client-side with a public key, same as Telegram/Instagram's GIF
// pickers). Needs NEXT_PUBLIC_GIPHY_API_KEY set - free at
// developers.giphy.com - and degrades to a plain explanation if it's
// missing rather than silently failing.
export default function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    const t = setTimeout(async () => {
      const endpoint = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query.trim())}&limit=21&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=21&rating=pg`;
      try {
        const res = await fetch(endpoint);
        const data = await res.json();
        type GiphyItem = { id: string; images: { original: { url: string }; fixed_width_small: { url: string } } };
        setGifs(
          ((data.data || []) as GiphyItem[]).map((g) => ({
            id: g.id,
            url: g.images.original.url,
            preview: g.images.fixed_width_small.url,
          }))
        );
      } catch {
        setGifs([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, apiKey]);

  return (
    <div className="ig-gif-picker-overlay" onClick={onClose}>
      <div className="ig-gif-picker" onClick={(e) => e.stopPropagation()}>
        <div className="ig-search-head">
          <input autoFocus placeholder="Search GIFs" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!apiKey && (
          <div className="ap-sugg-sub" style={{ padding: 16 }}>
            GIF search needs a Giphy API key. Get a free one at developers.giphy.com, then add it as{" "}
            <code>NEXT_PUBLIC_GIPHY_API_KEY</code> in your .env and redeploy.
          </div>
        )}
        {apiKey && loading && <div className="ap-loading">Loading…</div>}
        {apiKey && !loading && (
          <div className="ig-gif-grid">
            {gifs.map((g) => (
              <button key={g.id} onClick={() => onPick(g.url)}>
                <img src={g.preview} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
