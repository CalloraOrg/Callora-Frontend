/**
 * WhyApi.tsx
 *
 * Accessible "Why this API?" rationale surfaced on the marketplace ApiCard.
 *
 * It derives a short, human-readable list of reasons an API was recommended
 * from the metrics already present on the {@link APIItem} (rating, uptime,
 * latency, price and category). The reasons are revealed through a native
 * disclosure pattern: a toggle button (`aria-expanded` + `aria-controls`)
 * controlling a region, so it is fully keyboard-operable and announced
 * correctly by screen readers (WCAG 2.1 AA).
 *
 * Design tokens used (all theme-aware):
 *   --accent           primary highlight colour
 *   --accent-strong    secondary highlight / success indicator
 *   --muted            secondary text colour
 *   --surface-soft     subtle background fill
 *   --border-subtle    separator / border colour
 *
 * @example
 * ```tsx
 * import WhyApi from "./components/WhyApi";
 * // inside a card:
 * <WhyApi api={apiItem} />
 * ```
 */

import { useId, useState } from "react";
import type { APIItem } from "../data/mockApis";

// ─── Reason builder ──────────────────────────────────────────────────────────

/**
 * Derive a human-readable list of recommendation reasons from the API's
 * publicly available metrics.
 *
 * Thresholds:
 * - Rating  ≥ 4.5  → "Highly rated"
 * - Uptime  ≥ 99.9 % → "Reliable uptime"
 * - Latency ≤ 150 ms → "Fast responses"
 * - Price   ≤ $0.005 → "Cost-effective"
 * - Category present → "Popular choice in <category>"
 *
 * Falls back to a generic reason so the disclosure is never rendered empty.
 *
 * @param api - The {@link APIItem} to evaluate.
 * @returns   An array of at least one non-empty reason string.
 */
export function buildReasons(api: APIItem): string[] {
  const reasons: string[] = [];

  // High-quality signal: developer rating
  if (api.rating !== undefined && api.rating >= 4.5) {
    reasons.push(`Highly rated by developers (${api.rating.toFixed(1)} / 5)`);
  }

  // Reliability signal: uptime percentage
  if (api.uptimePercent !== undefined && api.uptimePercent >= 99.9) {
    reasons.push(`Reliable uptime (${api.uptimePercent.toFixed(2)}%)`);
  }

  // Performance signal: average latency
  if (api.avgLatencyMs !== undefined && api.avgLatencyMs <= 150) {
    reasons.push(`Fast responses (~${api.avgLatencyMs} ms average latency)`);
  }

  // Economic signal: per-call pricing
  // pricePerCall takes precedence; fall back to pricePerRequest.
  const price = api.pricePerCall ?? api.pricePerRequest;
  if (price !== undefined && price <= 0.005) {
    reasons.push("Cost-effective pricing per call");
  }

  // Discovery signal: category membership
  if (api.category) {
    reasons.push(`Popular choice in ${api.category}`);
  }

  // Guard: always provide at least one reason so the affordance is never empty.
  if (reasons.length === 0) {
    reasons.push("Matches your search and category filters");
  }

  return reasons;
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Props accepted by {@link WhyApi}. */
export interface WhyApiProps {
  /** The API item whose metrics are used to derive recommendation reasons. */
  api: APIItem;
}

/**
 * `WhyApi` — a disclosure widget that surfaces "why this API was recommended".
 *
 * Accessibility guarantees (WCAG 2.1 AA):
 * - Toggle button has `aria-expanded` mirroring open state.
 * - Toggle button has `aria-controls` pointing at the reasons list `id`.
 * - The reasons list has `aria-label` describing which API it covers.
 * - Chevron icon is `aria-hidden` so screen readers skip it.
 * - All check icons are `aria-hidden`; text is in a sibling `<span>`.
 * - Keyboard: Space / Enter toggle the disclosure; Tab moves focus naturally.
 * - `onClick` is stopped from bubbling so the parent card's click handler
 *   is not triggered when the user interacts with this widget.
 *
 * Styling:
 * - Uses BEM class names (`.why-api`, `.why-api__toggle`, `.why-api__reasons`,
 *   `.why-api__item`, `.why-api__check`, `.why-api__text`) defined in
 *   `index.css` and driven by design tokens.
 * - The reasons list uses a CSS transition so it animates open/close smoothly.
 */
export default function WhyApi({ api }: WhyApiProps) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const reasons = buildReasons(api);

  return (
    <div
      className="why-api"
      // Prevent the parent ApiCard click handler from firing when the user
      // interacts with this disclosure widget.
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Toggle button ── */}
      <button
        type="button"
        className={`why-api__toggle${open ? " why-api__toggle--open" : ""}`}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((o) => !o)}
      >
        {/* Decorative chevron — hidden from assistive technology */}
        <span className="why-api__chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        Why this API?
      </button>

      {/* ── Reasons list (controlled region) ── */}
      {open && (
        <ul
          id={regionId}
          className="why-api__reasons"
          aria-label={`Why ${api.name} is recommended`}
          role="list"
        >
          {reasons.map((reason, i) => (
            <li key={i} className="why-api__item">
              {/* Decorative check mark — hidden from assistive technology */}
              <span className="why-api__check" aria-hidden="true">✓</span>
              {/* Readable reason text */}
              <span className="why-api__text">{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
