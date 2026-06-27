import React, { useState, useRef, useEffect } from "react";

export interface RatingHistogramProps {
  rating: number;
  distribution?: Record<number, number>;
  children?: React.ReactNode;
}

export default function RatingHistogram({
  rating,
  distribution,
  children,
}: RatingHistogramProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dist = distribution || generateMockDistribution(rating);
  const total = Object.values(dist).reduce((sum, val) => sum + val, 0) || 1;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };
  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  const handleTouchStart = () => {
    // 400ms long press to show histogram on touch devices
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  return (
    <div
      className="rating-histogram-trigger"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {children}
      {isVisible && (
        <div
          className="surface rating-tooltip"
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            padding: "16px",
            width: "240px",
            zIndex: 50,
            boxShadow: "var(--shadow)",
            cursor: "default",
          }}
          onClick={(e) => e.stopPropagation()} // Prevent clicking through to parent card
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <strong style={{ fontSize: "1.5rem", color: "var(--text)" }}>
              {rating.toFixed(1)}
            </strong>
            <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              out of 5
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = dist[star] || 0;
              const percent = (count / total) * 100;
              return (
                <div
                  key={star}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.75rem",
                  }}
                  aria-label={`${star} stars: ${count} reviews`}
                >
                  <div
                    style={{
                      width: "32px",
                      textAlign: "right",
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {star} ★
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: "8px",
                      background: "var(--surface-soft)",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        background: "var(--accent)",
                        borderRadius: "999px",
                        transition: "width var(--transition-speed) ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: "28px",
                      textAlign: "right",
                      color: "var(--muted)",
                    }}
                  >
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function generateMockDistribution(rating: number): Record<number, number> {
  const total = 124;
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (rating >= 4.5) {
    dist[5] = Math.floor(total * 0.7);
    dist[4] = Math.floor(total * 0.2);
    dist[3] = Math.floor(total * 0.05);
    dist[2] = Math.floor(total * 0.03);
    dist[1] = total - dist[5] - dist[4] - dist[3] - dist[2];
  } else if (rating >= 4.0) {
    dist[5] = Math.floor(total * 0.4);
    dist[4] = Math.floor(total * 0.4);
    dist[3] = Math.floor(total * 0.1);
    dist[2] = Math.floor(total * 0.05);
    dist[1] = total - dist[5] - dist[4] - dist[3] - dist[2];
  } else {
    dist[5] = Math.floor(total * 0.2);
    dist[4] = Math.floor(total * 0.3);
    dist[3] = Math.floor(total * 0.3);
    dist[2] = Math.floor(total * 0.15);
    dist[1] = total - dist[5] - dist[4] - dist[3] - dist[2];
  }
  return dist;
}
