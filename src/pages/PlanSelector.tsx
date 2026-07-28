/**
 * PlanSelector.tsx
 *
 * Page component for selecting a pricing plan for an API endpoint.
 * Addresses Issue #710: when a user navigates a long API path hierarchy,
 * the breadcrumb trail is truncated with a middle-ellipsis so both the
 * namespace root and the terminal identifier remain visible.
 *
 * Middle-ellipsis truncation:
 * - Driven by the `maxLabelLength` prop on the shared `Breadcrumb` component.
 * - The full label is always preserved in the `title` attribute and ARIA
 *   accessible name so screen-reader and hover users see the complete value.
 * - Any crumb label that fits within `MAX_CRUMB_LABEL_LENGTH` characters is
 *   displayed in full — truncation only triggers when necessary.
 *
 * Responsive / accessibility:
 * - WCAG 2.1 AA: all interactive elements have visible focus rings via the
 *   global `focus.css` layer; the breadcrumb uses `aria-current="page"` on
 *   the current item.
 * - Design tokens used throughout — no inline hex values.
 * - Dark-mode and light-mode consistent via CSS custom properties.
 */

import React from "react";
import Breadcrumb, { type BreadcrumbItem } from "../components/Breadcrumb";
import PricingTierTable, { type PricingTier } from "../components/PricingTierTable";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum number of characters displayed per breadcrumb label before
 * middle-ellipsis truncation kicks in.
 *
 * 24 characters keeps compact single-line crumbs on most viewport widths
 * while still showing enough of the start and end of long API path segments.
 * Must be ≥ 8 per the Breadcrumb component's clamping rule.
 */
export const MAX_CRUMB_LABEL_LENGTH = 24;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanSelectorProps {
  /**
   * Breadcrumb trail leading to this plan-selector page.
   * The last item should have `isCurrent: true`.
   *
   * Example:
   * ```
   * [
   *   { label: "Marketplace", href: "/marketplace" },
   *   { label: "Natural Language Processing APIs", href: "/marketplace/nlp" },
   *   { label: "Select a Plan", href: "/marketplace/nlp/plans", isCurrent: true },
   * ]
   * ```
   */
  breadcrumbs: BreadcrumbItem[];

  /** Available pricing tiers to choose from. */
  tiers: PricingTier[];

  /**
   * Callback fired when the user selects a tier.
   * Receives the full `PricingTier` object for the chosen plan.
   */
  onSelectTier?: (tier: PricingTier) => void;

  /**
   * Optional heading override. Defaults to "Select a Plan".
   */
  heading?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PlanSelector
 *
 * Renders a breadcrumb navigation trail with middle-ellipsis overflow handling
 * followed by a `PricingTierTable` so users can choose a plan for the selected
 * API.
 *
 * The breadcrumb's `maxLabelLength` prop is set to `MAX_CRUMB_LABEL_LENGTH`
 * (24 characters) so long API path segments are shown as e.g.
 * "Natural Lan…ing APIs" instead of overflowing or being cut off at the tail.
 *
 * @example
 * ```tsx
 * <PlanSelector
 *   breadcrumbs={[
 *     { label: "Marketplace", href: "/marketplace" },
 *     { label: "Very Long API Category Name Here", href: "/marketplace/long" },
 *     { label: "Select a Plan", href: "/marketplace/long/plans", isCurrent: true },
 *   ]}
 *   tiers={pricingTiers}
 *   onSelectTier={(tier) => navigate(`/checkout/${tier.name}`)}
 * />
 * ```
 */
export default function PlanSelector({
  breadcrumbs,
  tiers,
  onSelectTier,
  heading = "Select a Plan",
}: PlanSelectorProps) {
  return (
    <section
      className="plan-selector"
      aria-labelledby="plan-selector-heading"
      style={{
        padding: "var(--space-page-padding, 24px)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl, 24px)",
      }}
    >
      {/*
       * Breadcrumb with middle-ellipsis truncation (Issue #710).
       *
       * maxLabelLength caps individual crumb labels at MAX_CRUMB_LABEL_LENGTH
       * characters. Anything longer is shortened to "start…end" so both the
       * namespace root and terminal identifier stay readable.
       *
       * Full labels are always available via `title` (hover tooltip) and
       * `aria-label` (screen reader) on each crumb element.
       */}
      <Breadcrumb items={breadcrumbs} maxLabelLength={MAX_CRUMB_LABEL_LENGTH} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-lg, 16px)",
        }}
      >
        <h1
          id="plan-selector-heading"
          style={{
            margin: 0,
            fontSize: "var(--font-size-2xl, 1.75rem)",
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          {heading}
        </h1>

        <PricingTierTable tiers={tiers} onSelectTier={onSelectTier} />
      </div>
    </section>
  );
}
