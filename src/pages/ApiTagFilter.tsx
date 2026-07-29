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
    </div>
  );
}
