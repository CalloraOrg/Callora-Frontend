/**
 * SortMenu
 *
 * Standalone component for the sort menu in the marketplace page.
 *
 * Print behaviour (issue #580 – GrantFox FWC26 / Stellar Wave campaign)
 * ─────────────────────────────────────────────────────────────────────
 *  • The sort dropdown and any other interactive chrome carry `no-print`
 *    so they are hidden when the page is sent to a printer or exported to PDF.
 *  • The sort options and controls are hidden in print media, while the
 *    current sort state is preserved and visible.
 *  • The collapsible sort menu is expanded when printing (see src/styles/print.css
 *    and the `@media print` block in src/index.css), so the full sort menu is
 *    always expanded when printed.
 *  • A print-only section heading (`sort-menu__print-heading`) is injected
 *    via CSS `content` (see print.css) rather than a visible DOM node, keeping
 *    the screen layout unaffected.
 *
 * Accessibility
 * ─────────────
 *  • The component wraps in a `<section>` with proper ARIA attributes.
 *  • The sort dropdown inherits accessibility from the SortDropdown component,
 *    which provides ARIA combobox/listbox roles (WAI-ARIA 1.2).
 *  • Arrow-key, Home/End, Enter, Escape navigation are handled by the
 *    underlying Dropdown primitive.
 *
 * Design tokens
 * ─────────────
 *  All colours reference CSS custom properties defined in
 *  `src/styles/tokens.css` / `src/index.css` so both dark-mode and light-mode
 *  (including the forced-light print override) work automatically.
 */

import React from "react";
import SortDropdown, { type SortValue } from "../components/SortDropdown";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SortMenuProps {
  /** Current selected sort value */
  value: SortValue;
  /** Called when the user selects a different sort option */
  onChange: (value: SortValue) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * SortMenu renders the sort menu for the marketplace page.
 *
 * Print-safe design
 * ─────────────────
 * Elements that carry `no-print` are suppressed in `@media print`.
 * The sort dropdown and any interactive controls use this class.
 *
 * The outer `<section>` carries the class `sort-menu` which the print
 * stylesheet uses to:
 *   1. Insert a decorative heading via `::before` (see print.css).
 *   2. Hide interactive chrome (sort dropdown) in print media.
 *   3. Expand any collapsible content when printing.
 */
const SortMenu: React.FC<SortMenuProps> = ({ value, onChange }) => {
  return (
    <section className="sort-menu" role="region" aria-label="Sort options">
      {/* Sort dropdown - hidden when printing */}
      <div className="sort-menu__sort-row no-print">
        <SortDropdown value={value} onChange={onChange} />
      </div>

      {/* Current sort state - visible when printing */}
      <div className="sort-menu__current-state">
        <span className="sort-menu__label">Sorted by:</span>
        <span className="sort-menu__value">
          {value === "popularity" && "Popularity"}
          {value === "price-asc" && "Price ascending"}
          {value === "latency-asc" && "Latency ascending"}
          {value === "newest" && "Newest"}
        </span>
      </div>
    </section>
  );
};

export default SortMenu;
