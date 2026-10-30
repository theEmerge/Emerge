// Quiet placeholders shown while data loads: nothing jumps when it arrives.
export function FeedSkeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1].map((i) => (
        <div className="sk-post" key={i}>
          <div className="sk-row">
            <span className="sk sk-circle" />
            <span className="sk-col">
              <span className="sk sk-line" style={{ width: 120 }} />
              <span className="sk sk-line" style={{ width: 70, height: 9 }} />
            </span>
          </div>
          <div className="sk sk-image" />
          <span className="sk sk-line" style={{ width: "70%", marginTop: 14 }} />
          <span className="sk sk-line" style={{ width: "45%", marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="ig-profile-grid ig-explore-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span className="sk sk-tile" key={i} />
      ))}
    </div>
  );
}
