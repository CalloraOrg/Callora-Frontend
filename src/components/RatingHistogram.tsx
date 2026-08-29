/**
 * RatingHistogram
 *
 * Wraps a rating display (e.g. "4.6 ★") and reveals a 5-star distribution
 * tooltip on hover, focus, or long-press (touch).
 *
 * Accessibility (WCAG 2.1 AA, SC 1.4.13 Content on Hover or Focus):
 *  - Dismissible: pressing Escape hides the tooltip.
 *  - Hoverable: pointer can move from trigger onto the tooltip without
 *    dismissing it (small close delay + tooltip mouseenter cancels the close).
 *  - Persistent: tooltip stays until pointer/focus leaves or user dismisses.
 *  - Keyboard: trigger is focusable (tabIndex 0); focus shows, blur hides.
 *  - Click on trigger does not propagate to a clickable ancestor (e.g. ApiCard).
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
} from "react";

export type RatingHistogramPlacement = "top" | "top-start" | "top-end";

export interface RatingHistogramProps {
  /** Average rating, 0–5. */
  rating: number;
  /** Per-star counts keyed by star value (1–5). Falls back to a derived mock when omitted. */
  distribution?: Record<number, number>;
  /** Trigger content (typically the inline rating display). */
  children?: React.ReactNode;
  /** How to anchor the tooltip relative to the trigger. Defaults to "top". */
  placement?: RatingHistogramPlacement;
}

const LONG_PRESS_MS = 400;
// Brief delay before closing on mouseleave so the pointer can travel from
// the trigger to the tooltip without it disappearing (WCAG 1.4.13 "Hoverable").
const HOVER_CLOSE_DELAY_MS = 120;

export default function RatingHistogram({
  rating,
  distribution,
  children,
  placement = "top",
}: RatingHistogramProps) {
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const dist = distribution ?? generateMockDistribution(rating);
  const total = Object.values(dist).reduce((sum, v) => sum + v, 0);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Escape dismisses (WCAG 1.4.13 "Dismissible").
  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsVisible(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isVisible]);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const open = useCallback(() => {
    cancelClose();
    setIsVisible(true);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(
      () => setIsVisible(false),
      HOVER_CLOSE_DELAY_MS,
    );
  }, [cancelClose]);

  const closeNow = useCallback(() => {
    cancelClose();
    setIsVisible(false);
  }, [cancelClose]);

  const handleTouchStart = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(open, LONG_PRESS_MS);
  };
  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    closeNow();
  };

  // Prevent activation of a clickable ancestor (e.g. ApiCard with role="button").
  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.stopPropagation();
    }
  };

  const placementStyle: React.CSSProperties =
    placement === "top-end"
      ? { right: 0 }
      : placement === "top-start"
        ? { left: 0 }
        : { left: "50%", transform: "translateX(-50%)" };

  const ratingLabel = `Rating ${rating.toFixed(1)} out of 5${
    total > 0 ? `, ${total} reviews` : ""
  }`;

  return (
    <span
      className="rating-histogram"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
      tabIndex={0}
      aria-label={ratingLabel}
      aria-describedby={isVisible ? tooltipId : undefined}
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
      onFocus={open}
      onBlur={closeNow}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={stopBubble}
      onKeyDown={handleKeyDown}
    >
      {children}
      {isVisible && (
        <div
          id={tooltipId}
          className="surface rating-histogram__tooltip"
          role="tooltip"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClick={stopBubble}
          style={{
            position: "absolute",
            bottom: "100%",
            marginBottom: "8px",
            padding: "16px",
            width: "240px",
            maxWidth: "calc(100vw - 32px)",
            zIndex: 50,
            boxShadow: "var(--shadow)",
            cursor: "default",
            ...placementStyle,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <strong
              style={{
                fontSize: "1.5rem",
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {rating.toFixed(1)}
            </strong>
            <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              out of 5
            </div>
            {total > 0 && (
              <div
                style={{
                  marginLeft: "auto",
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {total} {total === 1 ? "review" : "reviews"}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = dist[star] ?? 0;
              const percent = total > 0 ? (count / total) * 100 : 0;
              return (
                <div
                  key={star}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.75rem",
                  }}
                  aria-label={`${star} star${star === 1 ? "" : "s"}: ${count} ${count === 1 ? "review" : "reviews"}`}
                >
                  <div
                    style={{
                      width: "32px",
                      textAlign: "right",
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
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
                      fontVariantNumeric: "tabular-nums",
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
    </span>
  );
}

// Mock distribution used when an API has no concrete rating breakdown yet.
// Skews higher for higher averages so the preview "looks right" alongside
// the average rating.
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
