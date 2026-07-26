import { useMemo } from "react";
import MOCK_APIS from "../data/mockApis";
import { TagIcon } from "../components/icons";
import Tooltip from "../components/Tooltip";

/**
 * Extracts all unique tags from the mock API data, sorted alphabetically.
 * Memoised callers can cache for the lifetime of the page.
 */
export function getAllUniqueTags(): string[] {
  const tagSet = new Set<string>();
  for (const api of MOCK_APIS) {
    if (api.tags) {
      for (const t of api.tags) {
        tagSet.add(t.toLowerCase());
      }
    }
  }
  return [...tagSet].sort();
}

export interface ApiTagFilterProps {
  /** All available tags to display. Typically from getAllUniqueTags(). */
  tags: readonly string[];
  /** Currently selected tag (single-select mode), or null for "All". */
  selectedTag: string | null;
  /** Called when a tag is toggled. Pass null to clear. */
  onTagChange: (tag: string | null) => void;
  /** Optional hover delay in ms for tooltips on tag icon buttons. Defaults to 0. */
  hoverDelayMs?: number;
  /** Optional touch long-press duration in ms for tooltips. Defaults to 500. */
  longPressMs?: number;
}

/**
 * ApiTagFilter
 * ------------
 * A responsive, horizontal tag filter bar for narrow and wide viewports.
 *
 * **Wide viewports (>= 768 px):** Tags are laid out in a flex-wrap row so
 * all tags flow naturally without clipping.
 *
 * **Narrow viewports (< 768 px):** The bar switches to a horizontally
 * scrollable rail.  A thin custom scrollbar is shown so the pattern
 * remains discoverable.  All items stay single-line (`white-space:
 * nowrap`) to prevent a flood of wrapped tags on small phones.
 *
 * **Keyboard & screen-reader:**
 * - `role="group"` with `aria-label` groups the controls.
 * - Each pill is a `<button>` with `aria-pressed`.
 * - Tag icon buttons are wrapped in the shared {@link Tooltip} primitive
 *   (hover-delay + long-press) so the filter label is discoverable on
 *   touch and when the visible label is truncated.
 * - Focus-visible styling is inherited from the app-wide focus layer.
 *
 * **Design tokens:** Surface fills, borders, and colours all use CSS
 * custom properties from `tokens.css`.  Dark / light themes are
 * automatically supported.
 */
export default function ApiTagFilter({
  tags,
  selectedTag,
  onTagChange,
  hoverDelayMs = 0,
  longPressMs = 500,
}: ApiTagFilterProps) {
  const isAllSelected = selectedTag === null;

  /**
   * Compute result counts per tag so users can see which tags are
   * available and how many APIs match each one.  This is memoised
   * because it walks the full mock list on every render — it only
   * needs to change when `tags` change (which is effectively never
   * at runtime for the current demo dataset).
   */
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const api of MOCK_APIS) {
      if (!api.tags) continue;
      for (const t of api.tags) {
        const key = t.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [tags]);

  if (isLoading) {
    return <ApiTagFilterSkeleton />;
  }

  return (
    <div className="api-tag-filter" role="group" aria-label="Filter by tag">
      {/* ── "All" pill — always first, resets the filter ── */}
      <button
        type="button"
        className={`api-tag-filter__pill${isAllSelected ? " api-tag-filter__pill--active" : ""}`}
        aria-pressed={isAllSelected}
        onClick={() => onTagChange(null)}
      >
        All
      </button>

      {tags.map((tag) => {
        const isActive = selectedTag?.toLowerCase() === tag.toLowerCase();
        const count = tagCounts.get(tag.toLowerCase());
        const tooltipLabel = `Filter by tag ${tag}${count != null ? ` (${count} APIs)` : ""}`;

        return (
          <Tooltip
            key={tag}
            content={tooltipLabel}
            hoverDelayMs={hoverDelayMs}
            longPressMs={longPressMs}
          >
            <button
              type="button"
              className={`api-tag-filter__pill${isActive ? " api-tag-filter__pill--active" : ""}`}
              aria-pressed={isActive}
              aria-label={tooltipLabel}
              onClick={() => onTagChange(isActive ? null : tag)}
            >
              <TagIcon size={16} />
              <span>{tag}</span>
              {count != null && (
                <span className="api-tag-filter__count">{count}</span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
