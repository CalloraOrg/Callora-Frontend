import React from "react";
import type { Review } from "../data/mockApis";

interface RatingHistogramProps {
  reviews: Review[];
  averageRating: number;
}

/** A single filled or empty SVG star, accessible via aria-label on the parent. */
function Star({ filled, half }: { filled: boolean; half?: boolean }) {
  const id = React.useId();
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      {half && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="var(--accent, #f59e0b)" />
            <stop offset="50%" stopColor="var(--border-subtle, #374151)" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M10 1.5l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.77l-4.77 2.44.91-5.32L2.27 7.12l5.34-.78L10 1.5z"
        fill={
          half
            ? `url(#${id})`
            : filled
            ? "var(--accent, #f59e0b)"
            : "var(--border-subtle, #374151)"
        }
      />
    </svg>
  );
}

/** Five stars representing the given rating value (supports half-stars). */
function StarRating({ value }: { value: number }) {
  return (
    <span
      aria-label={`${value.toFixed(1)} out of 5 stars`}
      role="img"
      style={{ display: "flex", gap: 2 }}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const full = value >= i + 1;
        const half = !full && value >= i + 0.5;
        return <Star key={i} filled={full} half={half} />;
      })}
    </span>
  );
}

/**
 * RatingHistogram – displays the average score, total review count, and a
 * 5-bar rating distribution (5→1 star). Bars scale relative to the highest
 * bucket count, not total reviews.
 */
export default function RatingHistogram({
  reviews,
  averageRating,
}: RatingHistogramProps) {
  // Count reviews per star bucket (1–5)
  const counts = React.useMemo(() => {
    const tally = [0, 0, 0, 0, 0]; // index 0 = 1 star, index 4 = 5 stars
    for (const r of reviews) {
      const bucket = Math.min(5, Math.max(1, Math.round(r.rating)));
      tally[bucket - 1] += 1;
    }
    return tally;
  }, [reviews]);

  const maxCount = Math.max(...counts, 1); // avoid div-by-zero
  const total = reviews.length;

  return (
    <div
      style={{
        display: "flex",
        gap: "clamp(16px, 5vw, 40px)",
        alignItems: "flex-start",
        flexWrap: "wrap",
        padding: "20px 24px",
        background: "var(--bg-subtle, rgba(255,255,255,0.04))",
        borderRadius: 12,
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
        marginBottom: 24,
      }}
      aria-label="Rating distribution summary"
    >
      {/* Left: aggregate score */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          minWidth: 80,
        }}
      >
        <span
          style={{
            fontSize: "clamp(2rem, 6vw, 3rem)",
            fontWeight: 800,
            lineHeight: 1,
            color: "var(--text-main)",
          }}
          aria-label={`Average rating: ${averageRating.toFixed(1)}`}
        >
          {averageRating.toFixed(1)}
        </span>
        <StarRating value={averageRating} />
        <span
          style={{
            fontSize: 12,
            color: "var(--muted)",
            whiteSpace: "nowrap",
          }}
        >
          {total} {total === 1 ? "review" : "reviews"}
        </span>
      </div>

      {/* Right: histogram bars (5 star → 1 star) */}
      <div
        style={{
          flex: "1 1 160px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 0,
        }}
        role="list"
        aria-label="Reviews by star rating"
      >
        {[5, 4, 3, 2, 1].map((star) => {
          const count = counts[star - 1];
          const pct = Math.round((count / maxCount) * 100);
          return (
            <div
              key={star}
              role="listitem"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
              aria-label={`${star} star: ${count} ${count === 1 ? "review" : "reviews"}`}
            >
              {/* Star label with SVG star icon */}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 12,
                  color: "var(--muted)",
                  whiteSpace: "nowrap",
                  width: 36,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {star}
                <Star filled />
              </span>

              {/* Bar track */}
              <div
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: "var(--border-subtle, rgba(255,255,255,0.1))",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 4,
                    background: "var(--accent, #f59e0b)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>

              {/* Count */}
              <span
                aria-hidden="true"
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  width: 20,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
