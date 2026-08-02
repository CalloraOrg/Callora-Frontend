import Breadcrumb from "../components/Breadcrumb";
import type { BreadcrumbItem } from "../components/Breadcrumb";

type HeaderProps = {
  breadcrumbItems: ReadonlyArray<BreadcrumbItem>;
};

/**
 * Header – GrantFox FWC26 campaign top-level header.
 *
 * Renders a topbar banner with a breadcrumb navigation that
 * collapses long paths using a middle-ellipsis pattern: when
 * the breadcrumb has more than two segments, intermediate items
 * are hidden behind a "…" popover on all viewports so the first
 * and last segments remain visible.
 *
 * Accessibility:
 * - `role="banner"` identifies the landmark for assistive technology.
 * - The breadcrumb uses `aria-label="breadcrumb"` (handled by
 *   the Breadcrumb component) and exposes full labels via
 *   `title` / `aria-label` on truncated items.
 * - Focus is trapped inside the ellipsis popover while open;
 *   Escape closes and returns focus to the trigger button.
 *
 * Design-token consistency:
 * - Uses `var(--accent)`, `var(--text)`, `var(--muted)`,
 *   `var(--surface)`, `var(--border)`, `var(--accent-strong)`,
 *   and `var(--shadow)` from the global design-token system.
 * - Dark-mode values are defined in `src/index.css`.
 *
 * Responsive: collapses to a single-column layout on narrow viewports
 * with `padding-left: 0` and tighter gaps.
 */
export default function Header({ breadcrumbItems }: HeaderProps) {
  return (
    <header className="topbar no-print" role="banner">
      <div>
        <p className="eyebrow">Callora Vault</p>
        <p className="brand">Secure USDC funding for premium API usage</p>
      </div>

      <div className="topbar-actions">
        <Breadcrumb items={breadcrumbItems} middleEllipsis={true} maxLabelLength={28} />
      </div>
    </header>
  );
}