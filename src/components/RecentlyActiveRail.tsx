import { useMemo } from "react";
import type { APIItem } from "../data/mockApis";

/**
 * RecentlyActiveRail — a horizontally scrollable rail of APIs that have seen
 * the most recent usage. Surfaced on the Marketplace to help users discover
 * actively-maintained, in-demand APIs at a glance.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Rendered as a labelled region with a scrollable list.
 * - Each card is a real <button> so it is keyboard focusable and operable.
 * - Uses design tokens + dark-mode-friendly CSS variables only.
 */

type RecentlyActiveRailProps = {
  /** Source list of APIs to derive the "recently active" set from. */
  apis: APIItem[];
  /** Maximum number of APIs to show in the rail. Defaults to 8. */
  limit?: number;
  /** Invoked when a rail card is activated (click / Enter / Space). */
  onSelect?: (api: APIItem) => void;
};

/** Compact relative-time label, e.g. "3d ago". Falls back to "recently". */
function relativeUsage(api: APIItem): string {
  const iso = api.createdAt;
  if (!iso) return "recently";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "recently";
  const diffMs = Date.now() - ts;
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = Math.floor(diffDays / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

export default function RecentlyActiveRail({
  apis,
  limit = 8,
  onSelect,
}: RecentlyActiveRailProps): JSX.Element | null {
  // Rank by most recent creation/usage, then by raw usage volume as a tiebreak.
  const items = useMemo(() => {
    return apis
      .slice()
      .sort((a, b) => {
        const da = Date.parse(a.createdAt ?? "1970-01-01");
        const db = Date.parse(b.createdAt ?? "1970-01-01");
        if (db !== da) return db - da;
        return (b.usageCount ?? 0) - (a.usageCount ?? 0);
      })
      .slice(0, Math.max(0, limit));
  }, [apis, limit]);

  if (items.length === 0) return null;

  return (
    <section
      className="recently-active-rail"
      aria-label="Recently active APIs"
      style={{ marginBottom: "1.5rem" }}
    >
      <h2
        style={{
          fontSize: "0.95rem",
          fontWeight: 600,
          margin: "0 0 0.625rem",
          color: "var(--text-main)",
        }}
      >
        Recently active
      </h2>

      <ul
        style={{
          display: "flex",
          gap: "0.75rem",
          listStyle: "none",
          margin: 0,
          padding: "0 0 0.25rem",
          overflowX: "auto",
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((api) => (
          <li
            key={api.id}
            style={{ flex: "0 0 auto", scrollSnapAlign: "start" }}
          >
            <button
              type="button"
              onClick={() => onSelect?.(api)}
              aria-label={`${api.name} by ${api.provider?.name ?? "Unknown"}, last active ${relativeUsage(api)}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                width: "190px",
                textAlign: "left",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-subtle, #e5e7eb)",
                background: "var(--bg-highlight, var(--card-bg, #fff))",
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: "var(--success, #10b981)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "currentColor",
                  }}
                />
                {relativeUsage(api)}
              </span>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {api.name}
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted, #6b7280)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {api.provider?.name ?? "Unknown provider"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
