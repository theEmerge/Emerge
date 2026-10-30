"use client";
import { useRouter } from "next/navigation";
import { X, Clapperboard, Image as ImageIcon, CircleDot } from "lucide-react";

// The "+" in AppShell opens this instead of jumping straight to the post
// composer - Story and Reel each need a different page to actually pick
// their file, so this just routes there with a flag that page watches for
// (Reels.tsx: ?create=1, StoriesBar.tsx via Feed: ?create=story) and
// auto-opens its own file picker on arrival.
export default function NewPostChooser({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  function go(path: string) {
    onClose();
    router.push(path);
  }

  return (
    <div className="ig-search-overlay" onClick={onClose}>
      <div className="ig-new-post-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ig-search-head">
          <span className="ig-modal-title">Create</span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <button className="ig-new-post-option" onClick={() => go("/?create=story")}>
          <span className="ig-new-post-icon story">
            <CircleDot size={20} />
          </span>
          <div>
            <div className="ig-new-post-option-title">Story</div>
            <div className="ig-new-post-option-sub">Shares to your story for 24 hours</div>
          </div>
        </button>
        <button className="ig-new-post-option" onClick={() => go("/reels?create=1")}>
          <span className="ig-new-post-icon reel">
            <Clapperboard size={20} />
          </span>
          <div>
            <div className="ig-new-post-option-title">Reel</div>
            <div className="ig-new-post-option-sub">A short video for the Reels feed</div>
          </div>
        </button>
        <button className="ig-new-post-option" onClick={() => go("/?compose=1")}>
          <span className="ig-new-post-icon post">
            <ImageIcon size={20} />
          </span>
          <div>
            <div className="ig-new-post-option-title">Post</div>
            <div className="ig-new-post-option-sub">Share a photo to your feed</div>
          </div>
        </button>
      </div>
    </div>
  );
}
