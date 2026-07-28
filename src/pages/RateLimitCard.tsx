import Breadcrumb from "../components/Breadcrumb";
import useDocumentTitle from "../hooks/useDocumentTitle";

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
type RateLimitTier = {
  plan: string;
  requestsPerMinute: number;
  burstLimit: number;
  concurrentConnections: number;
};

const RATE_LIMIT_TIERS: RateLimitTier[] = [
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
const PLAN_PATTERNS: Record<string, { class: string; description: string }> = {
  Free: { class: "free", description: "solid baseline" },
  Developer: { class: "developer", description: "dot pattern" },
  Pro: { class: "pro", description: "diagonal stripes" },
  Enterprise: { class: "enterprise", description: "crosshatch pattern" },
};

export default function RateLimitCard() {
  useDocumentTitle(
    "Rate Limit Configuration – Callora",
    "Current rate-limit plan and throttling policies for the GrantFox Wave Compute API.",
  );

  return (
    <div className="rate-limit-page">
      <style>{`
        .rate-limit-page {
          padding: 0 32px 48px;
          max-width: 900px;
          margin: 0 auto;
        }

        .rate-limit-card {
          background: var(--surface);
          border: 1px solid var(--border, rgba(0, 0, 0, 0.10));
          border-radius: 12px;
          padding: 32px;
        }

        .rate-limit-card-header {
          margin-bottom: 24px;
        }

        .rate-limit-card-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 6px;
        }

        .rate-limit-card-subtitle {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 0;
        }

        .rate-limit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .rate-limit-table thead th {
          text-align: left;
          padding: 10px 16px;
          color: var(--muted);
          font-weight: 600;
          border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.10));
          white-space: nowrap;
        }

        .rate-limit-table tbody td {
          padding: 12px 16px;
          color: var(--text);
          border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        }

        .rate-limit-table tbody tr:last-child td {
          border-bottom: none;
        }

        .rate-limit-table tbody tr:hover td {
          background: var(--surface-raised, rgba(0, 0, 0, 0.025));
        }

        .rate-limit-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--accent-muted, rgba(78, 133, 255, 0.12));
          color: var(--accent);
        }

        .rate-limit-note {
          margin-top: 20px;
          padding: 12px 16px;
          background: var(--surface-raised, rgba(0, 0, 0, 0.025));
          border-radius: 8px;
          font-size: 0.8125rem;
          color: var(--muted);
          line-height: 1.5;
        }
      `}</style>

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
            {RATE_LIMIT_TIERS.map((tier) => (
              <tr key={tier.plan}>
                <td>
                  <span
                    className={`rate-limit-badge ${PLAN_PATTERNS[tier.plan].class}`}
                    data-pattern={PLAN_PATTERNS[tier.plan].description}
                  >
                    {tier.plan}
                  </span>
                </td>
                <td>{tier.requestsPerMinute.toLocaleString()}</td>
                <td>{tier.burstLimit.toLocaleString()}</td>
                <td>{tier.concurrentConnections.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

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
