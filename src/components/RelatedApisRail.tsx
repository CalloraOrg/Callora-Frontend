/**
 * RelatedApisRail.tsx
 *
 * Sidebar rail that surfaces APIs related to the one currently being viewed.
 * Relationship is determined by:
 *   1. Shared `category` (strongest signal)
 *   2. Shared `tags` (at least one tag in common)
 *
 * Up to `limit` results are shown (default 5), sorted by descending rating.
 * The current API is always excluded.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Rendered as a labelled `<section>` region.
 * - Each card is a real `<button>` — keyboard focusable and operable.
 * - Provides a visible rating label and price per request.
 * - Uses design tokens only (no hard-coded hex values).
 */

import { useMemo } from "react";
import type { APIItem } from "../data/mockApis";
import { formatPrice } from "../utils/format";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RelatedApisRailProps = {
  /** The API currently being viewed — it will be excluded from results. */
  currentApi: APIItem;
  /** All available APIs to search for related candidates. */
  allApis: APIItem[];
  /** Maximum number of related APIs to display. Defaults to 5. */
  limit?: number;
  /** Called when the user activates a related API card. */
  onSelect?: (api: APIItem) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a relevance-scored, deduplicated list of related APIs.
 *
 * Score:
 *  +2  same category
 *  +1  per shared tag (accumulates)
 *
 * Results are sorted by score DESC, then rating DESC as a tiebreaker.
 */
export function getRelatedApis(
  current: APIItem,
  all: APIItem[],
  limit: number,
): APIItem[] {
  const currentTags = new Set((current.tags ?? []).map((t) => t.toLowerCase()));

  return all
    .filter((api) => api.id !== current.id)
    .map((api) => {
      let score = 0;

      if (
        current.category &&
        api.category &&
        api.category.toLowerCase() === current.category.toLowerCase()
      ) {
        score += 2;
      }

      for (const tag of api.tags ?? []) {
        if (currentTags.has(tag.toLowerCase())) {
          score += 1;
        }
      }

      return { api, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.api.rating ?? 0) - (a.api.rating ?? 0);
    })
    .slice(0, Math.max(0, limit))
    .map(({ api }) => api);
}

/** Star-rating display: e.g. "4.6 ★" */
function RatingLabel({ rating }: { rating: number }) {
  return (
    <span
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
      style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M10 1.5l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.77l-4.77 2.44.91-5.32L2.27 7.12l5.34-.78L10 1.5z"
          fill="var(--accent)"
        />
      </svg>
      {rating.toFixed(1)}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * RelatedApisRail
 *
 * Displays a vertical list of related API cards inside the ApiDetailPage
 * sidebar. Returns `null` when no related APIs are found so the caller
 * does not need to guard the render.
 */
export default function RelatedApisRail({
  currentApi,
  allApis,
  limit = 5,
  onSelect,
}: RelatedApisRailProps): JSX.Element | null {
  const items = useMemo(
    () => getRelatedApis(currentApi, allApis, limit),
    [currentApi, allApis, limit],
  );

  if (items.length === 0) return null;

  return (
    <section
      className="related-apis-rail"
      aria-label="Related APIs"
      style={{ marginTop: 24 }}
    >
      {/* ── Heading ──────────────────────────────────────────────────────── */}
      <h4
        style={{
          margin: "0 0 12px",
          fontSize: "0.8rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--muted)",
        }}
      >
        Related APIs
      </h4>

      {/* ── Card list ────────────────────────────────────────────────────── */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {items.map((api) => (
          <li key={api.id}>
            <button
              type="button"
              onClick={() => {
                onSelect?.(api);
                // Default navigation to the detail page for this API.
                if (!onSelect) {
                  window.location.href = `/details/${api.id}`;
                }
              }}
              aria-label={`View details for ${api.name} by ${api.provider?.name ?? "Unknown"}`}
              style={{
                width: "100%",
                textAlign: "left",
                background: "var(--surface-soft)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer",
                color: "var(--text)",
                transition: "border-color 160ms ease, background 160ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--accent)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(78,133,255,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--line)";
                (e.currentTarget as HTMLElement).style.background =
                  "var(--surface-soft)";
              }}
            >
              {/* Name + provider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                {/* Icon avatar */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(78,133,255,0.12)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--accent)",
                    flexShrink: 0,
                  }}
                >
                  {api.name[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {api.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {api.provider?.name ?? "Unknown provider"}
                  </div>
                </div>
              </div>

              {/* Category chip */}
              {api.category && (
                <div
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    background: "rgba(78,133,255,0.1)",
                    color: "var(--accent)",
                    marginBottom: 8,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {api.category}
                </div>
              )}

              {/* Price + rating row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                }}
              >
                <span>
                  <strong style={{ color: "var(--text)" }}>
                    ${formatPrice(api.pricePerRequest ?? 0)}
                  </strong>
                  {" / req"}
                </span>

                {api.rating !== undefined && (
                  <RatingLabel rating={api.rating} />
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* ── Footer link ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a
          href="/marketplace"
          style={{
            fontSize: "0.78rem",
            color: "var(--accent)",
            textDecoration: "none",
            fontWeight: 600,
          }}
          aria-label="Browse all APIs in the marketplace"
        >
          Browse all APIs →
        </a>
      </div>
    </section>
  );
}
