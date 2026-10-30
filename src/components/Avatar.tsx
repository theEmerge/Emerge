import Image from "next/image";

const PALETTE = ["#FF5D3B", "#F14F2D", "#FF7A3D", "#E8472A", "#FF8A5C", "#D9481F"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Renders a real photo when src is set (a Cloudinary URL from
// avatarUrl), otherwise falls back to the original colored-initials
// squircle - every existing call site that doesn't pass src keeps working
// unchanged.
export default function Avatar({ name, size = 40, src }: { name: string; size?: number; src?: string | null }) {
  if (src) {
    return (
      <div
        className="ap-avatar ap-avatar-photo"
        style={{ width: size, height: size, borderRadius: "30%", overflow: "hidden", flexShrink: 0, position: "relative" }}
      >
        <Image src={src} alt={name} fill sizes={`${size}px`} style={{ objectFit: "cover" }} />
      </div>
    );
  }

  const initials = initialsOf(name || "?");
  return (
    <div
      className="ap-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: "30%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body), system-ui, sans-serif",
        fontSize: size * 0.36,
        fontWeight: 600,
        color: "#fff",
        background: colorFor(name || "x"),
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
