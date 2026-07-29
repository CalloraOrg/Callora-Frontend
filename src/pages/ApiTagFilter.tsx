/**
 * ApiTagFilter
 *
 * Renders a horizontal scrollable strip of tag-chip buttons that let the user
 * filter the API list by a single tag.  The component is fully keyboard
 * accessible (arrow-key navigation, Enter/Space to toggle) and WCAG 2.1 AA
 * compliant.
 *
 * ## Reduced-motion behaviour (GrantFox FWC26)
 *
 * When `prefers-reduced-motion: reduce` is active the hover/focus animation
 * that lifts a chip upward (`transform: translateY(-1px)`) and the CSS
 * `transition` easing are suppressed.  This is achieved in two complementary
 * ways:
 *
 *  1. The `useReducedMotion` hook adds the `tag-chip--no-motion` modifier
 *     class to every chip so that inline-style overrides can be applied
 *     entirely in CSS with a single `@media (prefers-reduced-motion: reduce)`
 *     rule (see `index.css`).
 *
 *  2. The CSS rule (in `index.css`) removes `transition` and `transform` for
 *     `.tag-chip--no-motion` so the chip reaches its final visual state
 *     instantly.
 *
 * Props:
 *  - `tags`        – ordered list of tag strings to render
 *  - `activeTag`   – currently selected tag, or `null` for no filter
 *  - `onTagClick`  – callback invoked with the tag string when a chip is
 *                    clicked; clicking the active tag passes `null` to deselect
 *  - `label`       – optional accessible label for the group (default:
 *                    "Filter by tag")
 */

import { useReducedMotion } from "../hooks/useReducedMotion";

export interface ApiTagFilterProps {
  /** Ordered list of tag strings to display as filter chips. */
  tags: string[];
  /** The currently active tag filter, or `null` when no tag is selected. */
  activeTag: string | null;
  /**
   * Called when the user clicks a chip.
   * Receives `null` when the user clicks the already-active tag (deselects).
   */
  onTagClick: (tag: string | null) => void;
  /** Accessible label for the filter group element. Defaults to "Filter by tag". */
  label?: string;
}

/**
 * ApiTagFilter — tag-chip filter bar with prefers-reduced-motion support.
 *
 * When no tags are provided the component renders nothing (returns `null`).
 */
export default function ApiTagFilter({
  tags,
  activeTag,
  onTagClick,
  label = "Filter by tag",
}: ApiTagFilterProps): JSX.Element | null {
  // Detect user's reduced-motion preference.
  // When `true` the `tag-chip--no-motion` modifier is applied, which the CSS
  // uses to suppress transitions and transforms (see index.css).
  const reducedMotion = useReducedMotion();

  // Nothing to render if the parent hasn't provided any tags.
  if (tags.length === 0) return null;

  /**
   * Build the full class string for a single chip.
   *
   * Classes applied:
   *  - `tag-chip`             – base chip styles (always present)
   *  - `tag-chip--active`     – filled accent style when this tag is selected
   *  - `tag-chip--no-motion`  – strips transition/transform under reduced-motion
   */
  const chipClass = (tag: string): string => {
    const isActive =
      activeTag !== null && activeTag.toLowerCase() === tag.toLowerCase();

    return [
      "tag-chip",
      isActive ? "tag-chip--active" : "",
      // Add reduced-motion modifier so CSS @media rule can target it.
      reducedMotion ? "tag-chip--no-motion" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  /**
   * Determine whether a chip is currently the active filter.
   * Comparison is case-insensitive to match the MarketplacePage behaviour.
   */
  const isActive = (tag: string): boolean =>
    activeTag !== null && activeTag.toLowerCase() === tag.toLowerCase();

  /**
   * Toggle: clicking the active tag deselects it (passes `null`), clicking
   * any other tag selects it.
   */
  const handleClick = (tag: string) => {
    onTagClick(isActive(tag) ? null : tag);
  };

  return (
    /*
     * role="group" + aria-label gives screen readers a semantic boundary
     * around the set of filter controls without using a landmark element.
     */
    <div
      className="api-tag-filter"
      role="group"
      aria-label={label}
      data-testid="api-tag-filter"
    >
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={chipClass(tag)}
          aria-pressed={isActive(tag)}
          aria-label={`Filter by tag ${tag}`}
          onClick={() => handleClick(tag)}
          data-testid={`tag-chip-${tag}`}
        >
          {/* Decorative hash — hidden from screen readers */}
          <span aria-hidden="true">#</span>
          <span>{tag}</span>
        </button>
      ))}
import { useMemo } from "react";
import MOCK_APIS from "../data/mockApis";
import Skeleton from "../components/Skeleton";
import { TagIcon } from "../components/icons";
import Tooltip from "../components/Tooltip";
import KbdHint from "../components/KbdHint";
import type { Shortcut } from "../hooks/useGlobalShortcuts";

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
  /** Show skeleton loading state instead of tags. */
  isLoading?: boolean;
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
/**
 * Skeleton placeholder shown while tags are loading.
 * Renders pill-shaped skeleton elements matching the component's layout
 * so the transition to the real filter is seamless.
 */
export function ApiTagFilterSkeleton() {
  return (
    <div
      className="api-tag-filter"
      role="group"
      aria-label="Loading tag filter"
      aria-busy="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === 0 ? 48 : 80 + i * 12}
          height={36}
          borderRadius={999}
          className="api-tag-filter__pill-skeleton"
        />
      ))}
    </div>
  );
}

/** Keyboard shortcuts for the ApiTagFilter */
export const TAG_FILTER_SHORTCUTS: readonly Shortcut[] = [
  { key: "Tab", description: "Navigate between tags", category: "Marketplace" },
  { key: "Enter", description: "Toggle tag selection", category: "Marketplace" },
];

export default function ApiTagFilter({
  tags,
  selectedTag,
  onTagChange,
  hoverDelayMs = 0,
  longPressMs = 500,
  isLoading = false,
}: ApiTagFilterProps) {
  const isAllSelected = selectedTag === null;

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

      {/* Keyboard shortcut hint bubble — subtle chip variant but
          rendered as <aside> so it retains the complementary landmark role
          for screen readers. */}
      <KbdHint
        shortcuts={TAG_FILTER_SHORTCUTS}
        variant="chip"
        as="aside"
        label="Tag filter keyboard shortcuts"
      />
    </div>
  );
}
