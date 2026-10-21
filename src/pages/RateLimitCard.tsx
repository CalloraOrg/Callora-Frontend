import { useEffect, useState } from "react";
import Breadcrumb from "../components/Breadcrumb";
import useDocumentTitle from "../hooks/useDocumentTitle";
import "./RateLimitCard.css";

/**
 * RateLimitCard – GrantFox FWC26 campaign "Stellar Wave" (issue #567)
 *
 * Displays rate-limit configuration for a deeply nested API endpoint.
 * The breadcrumb path intentionally contains long segment names to exercise
 * the middle-ellipsis truncation feature (`maxLabelLength` prop) added to
 * the Breadcrumb component.
 *
 * The breadcrumb trail is:
 *   Marketplace → GrantFox Wave Compute API (long) → Rate Limits → Current Page
 *
 * With `maxLabelLength={28}` the two middle segments are each capped at
 * 28 characters in the visible label while the full strings remain available
 * via `title` / `aria-label` for screen readers and on hover.
 */

/** Rate-limit tier shape used in the table below. */
export type RateLimitTier = {
  plan: string;
  requestsPerMinute: number;
  burstLimit: number;
  concurrentConnections: number;
};

export const RATE_LIMIT_TIERS: RateLimitTier[] = [
  {
    plan: "Free",
    requestsPerMinute: 10,
    burstLimit: 20,
    concurrentConnections: 2,
  },
  {
    plan: "Developer",
    requestsPerMinute: 120,
    burstLimit: 200,
    concurrentConnections: 10,
  },
  {
    plan: "Pro",
    requestsPerMinute: 600,
    burstLimit: 1000,
    concurrentConnections: 50,
  },
  {
    plan: "Enterprise",
    requestsPerMinute: 6000,
    burstLimit: 10000,
    concurrentConnections: 500,
  },
];

/**
 * Breadcrumb path for this page.  Segment labels are deliberately long so the
 * middle-ellipsis truncation is visible without special configuration.
 *
 * Full path (un-truncated):
 *   Marketplace
 *     → GrantFox Wave Compute API – Stellar Edition
 *     → Rate Limits & Throttling Policies
 *     → Current Plan Configuration  (current page)
 */
const BREADCRUMB_ITEMS = [
  { label: "Marketplace", href: "/marketplace" },
  {
    label: "GrantFox Wave Compute API – Stellar Edition",
    href: "/marketplace/grantfox-wave-compute",
  },
  {
    label: "Rate Limits & Throttling Policies",
    href: "/marketplace/grantfox-wave-compute/rate-limits",
  },
  {
    label: "Current Plan Configuration",
    href: "/marketplace/grantfox-wave-compute/rate-limits/config",
    isCurrent: true,
  },
] as const;

/**
 * Maximum characters before a crumb label is shortened with a middle-ellipsis.
 * Chosen so the two long middle segments fit comfortably in a single breadcrumb
 * row even on narrow viewports.
 */
const BREADCRUMB_MAX_LABEL = 28;

/** Pattern class and description for each plan tier (color-blind safe). */
export const PLAN_PATTERNS: Record<string, { class: string; description: string }> = {
  Free: { class: "free", description: "solid baseline" },
  Developer: { class: "developer", description: "dot pattern" },
  Pro: { class: "pro", description: "diagonal stripes" },
  Enterprise: { class: "enterprise", description: "crosshatch pattern" },
};

export type RateLimitCardProps = {
  /** Currently active plan tier (e.g. "Pro" or "Developer"). */
  currentPlan?: string;
  /** Force mobile card view (defaults to window viewport query < 640px). */
  isMobile?: boolean;
};

function useMediaQuery(query: string, maxPixelThreshold?: number): boolean {
  const evaluate = () => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") {
      const mql = window.matchMedia(query);
      if (mql.matches) return true;
    }
    if (maxPixelThreshold !== undefined && typeof window.innerWidth === "number") {
      if (window.innerWidth > 0 && window.innerWidth < maxPixelThreshold) {
        return true;
      }
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(evaluate);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setMatches(evaluate());
    update();

    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia(query);
      if (mql.addEventListener) {
        mql.addEventListener("change", update);
      } else if ((mql as any).addListener) {
        (mql as any).addListener(update);
      }
    }

    window.addEventListener("resize", update);

    return () => {
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener("change", update);
        } else if ((mql as any).removeListener) {
          (mql as any).removeListener(update);
        }
      }
      window.removeEventListener("resize", update);
    };
  }, [query, maxPixelThreshold]);

  return matches;
}

export default function RateLimitCard({
  currentPlan,
  isMobile: isMobileProp,
}: RateLimitCardProps = {}) {
  useDocumentTitle(
    "Rate Limit Configuration – Callora",
    "Current rate-limit plan and throttling policies for the GrantFox Wave Compute API.",
  );

  const isViewportMobile = useMediaQuery("(max-width: 639px)", 640);
  const isMobile = isMobileProp !== undefined ? isMobileProp : isViewportMobile;

  const isCurrentPlan = (plan: string) =>
    Boolean(currentPlan && plan.toLowerCase() === currentPlan.toLowerCase());

  return (
    <div className="rate-limit-page">
      {/*
        Breadcrumb uses maxLabelLength={28} so each crumb label is capped at
        28 characters.  Both long middle-segment names will be shown with a
        "…" in the middle, preserving the start and end of the real label.
        The full strings are always in `title` / `aria-label`.
      */}
      <Breadcrumb
        items={BREADCRUMB_ITEMS}
        maxLabelLength={BREADCRUMB_MAX_LABEL}
      />

      <div className="rate-limit-card">
        <div className="rate-limit-card-header">
          <h1 className="rate-limit-card-title">Rate Limit Configuration</h1>
          <p className="rate-limit-card-subtitle">
            GrantFox Wave Compute API – Stellar Edition &nbsp;·&nbsp; FWC26
          </p>
        </div>

        {isMobile ? (
          <div className="rate-limit-cards" aria-label="Rate limit tiers">
            {RATE_LIMIT_TIERS.map((tier) => {
              const isCurrent = isCurrentPlan(tier.plan);
              return (
                <div
                  key={tier.plan}
                  className={`rate-limit-plan-card ${isCurrent ? "rate-limit-plan-card--current" : ""}`}
                  {...(isCurrent ? { "aria-current": "true" } : {})}
                >
                  <div className="rate-limit-plan-card-header">
                    <div className="rate-limit-plan-title-group">
                      <span
                        className={`rate-limit-badge ${PLAN_PATTERNS[tier.plan].class}`}
                        data-pattern={PLAN_PATTERNS[tier.plan].description}
                      >
                        {tier.plan}
                      </span>
                      <span className="rate-limit-pattern-desc">
                        {PLAN_PATTERNS[tier.plan].description}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="rate-limit-current-badge">
                        Current plan
                      </span>
                    )}
                  </div>

                  <dl className="rate-limit-plan-dl">
                    <div className="rate-limit-dl-row">
                      <dt title="Requests per minute">Requests/min</dt>
                      <dd>
                        <span className="rate-limit-number">
                          {tier.requestsPerMinute.toLocaleString()}
                        </span>
                      </dd>
                    </div>
                    <div className="rate-limit-dl-row">
                      <dt title="Burst limit">Burst</dt>
                      <dd>
                        <span className="rate-limit-number">
                          {tier.burstLimit.toLocaleString()}
                        </span>
                      </dd>
                    </div>
                    <div className="rate-limit-dl-row">
                      <dt title="Concurrent connections">Concurrent</dt>
                      <dd>
                        <span className="rate-limit-number">
                          {tier.concurrentConnections.toLocaleString()}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="rate-limit-table" aria-label="Rate limit tiers">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Requests / min</th>
                <th scope="col">Burst limit</th>
                <th scope="col">Concurrent connections</th>
              </tr>
            </thead>
            <tbody>
              {RATE_LIMIT_TIERS.map((tier) => {
                const isCurrent = isCurrentPlan(tier.plan);
                return (
                  <tr
                    key={tier.plan}
                    {...(isCurrent ? { "aria-current": "true" } : {})}
                  >
                    <td>
                      <div className="rate-limit-plan-cell">
                        <span
                          className={`rate-limit-badge ${PLAN_PATTERNS[tier.plan].class}`}
                          data-pattern={PLAN_PATTERNS[tier.plan].description}
                        >
                          {tier.plan}
                        </span>
                        <span className="rate-limit-pattern-desc">
                          {PLAN_PATTERNS[tier.plan].description}
                        </span>
                        {isCurrent && (
                          <span className="rate-limit-current-badge">
                            Current plan
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="rate-limit-number">
                        {tier.requestsPerMinute.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="rate-limit-number">
                        {tier.burstLimit.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="rate-limit-number">
                        {tier.concurrentConnections.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="rate-limit-note">
          Limits reset on a rolling 60-second window. Burst allowance is
          consumed first; sustained throughput is governed by the per-minute
          quota. Enterprise plans can request custom limits via the support
          portal.
        </p>
      </div>
    </div>
  );
}
