"use client";

// A curated, fixed grid rather than a full Unicode emoji library - no
// dependency, no bundle-size cost, covers the emojis people actually reach
// for in chat. Click outside (the invisible backdrop) or Escape closes it.
const EMOJIS = [
  "😀", "😂", "😊", "😍", "😘", "😎", "🤔", "😅",
  "😭", "🙏", "👍", "👎", "🔥", "🎉", "❤️", "💙",
  "😢", "😡", "👏", "🙌", "✨", "💯", "🤝", "😴",
  "🥳", "😇", "🤗", "😜", "🙃", "👀", "🤯", "😬",
];

export default function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="ig-picker-backdrop" onClick={onClose} />
      <div className="ig-emoji-picker">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
