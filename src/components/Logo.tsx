// Pure CSS/text brand mark - no image request, no theme flash, crisp at any size.
// `width` keeps the old prop meaning (roughly the rendered width of the lockup).
export default function Logo({
  width,
  className,
}: {
  width: number;
  className?: string;
  priority?: boolean;
}) {
  const mark = Math.round(width * 0.2);
  const name = Math.round(width * 0.122);
  return (
    <span
      className={"brand" + (className ? " " + className : "")}
      style={{
        gap: Math.round(mark * 0.35),
        display: className ? "flex" : "inline-flex",
        justifyContent: className ? "center" : undefined,
      }}
      aria-label="Emerge"
    >
      <span className="brand-mark" style={{ width: mark, height: mark }}>
        {/* drawn, not typed: a font glyph sits off-centre in its line box */}
        <svg width={mark * 0.62} height={mark * 0.62} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6.6 12H17.4A5.4 5.4 0 1 0 15.82 15.82" />
        </svg>
      </span>
      <span className="brand-name" style={{ fontSize: name }}>
        emerge
      </span>
    </span>
  );
}
