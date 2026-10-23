import type { CSSProperties } from "react";

/**
 * StarRating — a small, accessible rating widget.
 *
 * Polish goals (issue #285):
 * - Round ratings consistently (half-up) so the same numeric value always
 *   renders the same way.
 * - Pad the display to a fixed number of decimals so values never jump width
 *   in a list (e.g. "4.0", "4.6", "5.0" instead of "4", "4.6", "5").
 *
 * Accessibility (WCAG 2.1 AA):
 * - Exposes a descriptive `aria-label` ("Rated 4.6 out of 5").
 * - Star glyphs are decorative (`aria-hidden`); the padded number is the
 *   accessible value.
 * - Colour comes from design tokens so it stays legible in dark mode.
 */

const MAX_STARS = 5;

export type StarRatingProps = {
  /** Raw rating value, expected in the 0–5 range. Clamped defensively. */
  value: number;
  /** Decimal places for the displayed number. Defaults to 1 ("4.0"). */
  decimals?: number;
  /** Hide the numeric label and show stars only. */
  hideNumber?: boolean;
  /** Optional extra class for layout. */
  className?: string;
  style?: CSSProperties;
};

/**
 * Round a rating consistently (half-up) to the given number of decimals and
 * return a zero-padded fixed-width string.
 *
 * Exported so display logic can be unit-tested without rendering.
 */
export function formatRating(value: number, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  const clamped = Math.min(MAX_STARS, Math.max(0, safe));
  // toFixed already rounds half-up for positive numbers and pads decimals.
  return clamped.toFixed(Math.max(0, decimals));
}

export default function StarRating({
  value,
  decimals = 1,
  hideNumber = false,
  className,
  style,
}: StarRatingProps): JSX.Element {
  const display = formatRating(value, decimals);
  // Number of fully "lit" stars, rounded to the nearest whole star.
  const litStars = Math.round(Math.min(MAX_STARS, Math.max(0, value || 0)));

  return (
    <span
      className={className}
      role="img"
      aria-label={`Rated ${display} out of ${MAX_STARS}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        color: "var(--rating-color, #f59e0b)",
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ letterSpacing: "1px", lineHeight: 1 }}>
        {Array.from({ length: MAX_STARS }, (_, i) =>
          i < litStars ? "★" : "☆",
        ).join("")}
      </span>
      {!hideNumber && (
        <span
          aria-hidden="true"
          style={{
            color: "var(--text-main)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            // Fixed width keeps numbers aligned in lists regardless of value.
            minWidth: `${display.length}ch`,
          }}
        >
          {display}
        </span>
      )}
    </span>
  );
}
