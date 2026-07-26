/**
 * RateLimitCard.tsx
 *
 * Displays rate-limit status for a subscribed API endpoint.  The card shows:
 *   - A deep breadcrumb trail (Marketplace → Provider → API → Plan → Endpoint)
 *     where individual segments can be long slugs or versioned names; the
 *     `middleEllipsis` prop on <Breadcrumb> ensures those labels are
 *     abbreviated with a "start…end" pattern so the path never overflows its
 *     container.
 *   - Current request quota (used / total) with a visual progress bar.
 *   - Reset timestamp (next window start).
 *   - A brief status badge (OK / Warning / Critical) derived from the usage
 *     percentage, using the project's design tokens and the same pattern-based
 *     approach as StatusBadge for colour-blind accessibility.
 *
 * ## Props
 * | Prop            | Type                | Default          | Description                             |
 * |-----------------|---------------------|------------------|-----------------------------------------|
 * | apiName         | string              | required         | Human-readable API name                 |
 * | providerName    | string              | required         | Provider / organisation name            |
 * | planName        | string              | required         | Subscription plan name                  |
 * | endpointPath    | string              | required         | Endpoint path, e.g. "/v2/completions"   |
 * | requestsUsed    | number              | required         | Requests consumed in current window     |
 * | requestsTotal   | number              | required         | Total requests allowed in the window    |
 * | resetAt         | Date                | required         | Timestamp when the rate limit resets    |
 * | apiId           | string              | "api"            | ID segment used in breadcrumb hrefs     |
 * | providerId      | string              | "provider"       | ID segment used in breadcrumb hrefs     |
 *
 * @example
 * ```tsx
 * <RateLimitCard
 *   apiName="Advanced Language Model – Completions API (v2)"
 *   providerName="OpenMind AI"
 *   planName="Professional Tier – High Throughput"
 *   endpointPath="/v2/completions/streaming"
 *   requestsUsed={8200}
 *   requestsTotal={10000}
 *   resetAt={new Date(Date.now() + 3600_000)}
 * />
 * ```
 */

import Breadcrumb from "../components/Breadcrumb";
import type { BreadcrumbItem } from "../components/Breadcrumb";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitCardProps {
  /** Human-readable API name (may be long). */
  apiName: string;
  /** Provider / organisation display name. */
  providerName: string;
  /** Subscription plan display name (may be long). */
  planName: string;
  /** Endpoint path shown as the leaf crumb, e.g. "/v2/generate". */
  endpointPath: string;
  /** Number of requests consumed in the current rate-limit window. */
  requestsUsed: number;
  /** Total requests allowed per rate-limit window. */
  requestsTotal: number;
  /** Date/time when the current rate-limit window resets. */
  resetAt: Date;
  /**
   * URL-safe identifier for the API, used to build breadcrumb hrefs.
   * @default "api"
   */
  apiId?: string;
  /**
   * URL-safe identifier for the provider, used to build breadcrumb hrefs.
   * @default "provider"
   */
  providerId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derived usage status used for the badge and progress bar colour. */
type RateLimitStatus = "ok" | "warning" | "critical";

function getStatus(used: number, total: number): RateLimitStatus {
  if (total <= 0) return "ok";
  const pct = used / total;
  if (pct >= 0.9) return "critical";
  if (pct >= 0.7) return "warning";
  return "ok";
}

/**
 * Format a Date as a human-readable relative string ("in 47 min") and an
 * absolute ISO string for the <time> datetime attribute.
 */
function formatResetTime(resetAt: Date): { relative: string; iso: string } {
  const iso = resetAt.toISOString();
  const diffMs = resetAt.getTime() - Date.now();
  if (diffMs <= 0) return { relative: "resetting…", iso };

  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return { relative: `in ${diffSec}s`, iso };

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return { relative: `in ${diffMin} min`, iso };

  const diffHr = Math.round(diffMin / 60);
  return { relative: `in ${diffHr} hr`, iso };
}

// ─── STATUS_META: labels, colours, and ARIA descriptions ─────────────────────

const STATUS_META: Record<
  RateLimitStatus,
  { label: string; color: string; ariaLabel: string }
> = {
  ok: {
    label: "OK",
    color: "var(--success, #10b981)",
    ariaLabel: "Rate limit status: within quota",
  },
  warning: {
    label: "Warning",
    color: "var(--warning, #fbbf24)",
    ariaLabel: "Rate limit status: approaching quota",
  },
  critical: {
    label: "Critical",
    color: "var(--danger, #dc2626)",
    ariaLabel: "Rate limit status: quota nearly exhausted",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RateLimitCard({
  apiName,
  providerName,
  planName,
  endpointPath,
  requestsUsed,
  requestsTotal,
  resetAt,
  apiId = "api",
  providerId = "provider",
}: RateLimitCardProps) {
  const pct = requestsTotal > 0 ? Math.min(requestsUsed / requestsTotal, 1) : 0;
  const status = getStatus(requestsUsed, requestsTotal);
  const meta = STATUS_META[status];
  const resetTime = formatResetTime(resetAt);

  /**
   * Breadcrumb path: Marketplace → Provider → API → Plan → Endpoint
   *
   * All five labels can contain long, technical names (e.g. versioned API
   * names, detailed plan tiers, endpoint slugs), so we pass
   * `middleEllipsis` to let Breadcrumb trim them with the "start…end"
   * pattern.  The full label is always available via the title tooltip and
   * the accessible aria-label.
   */
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Marketplace", href: "/marketplace" },
    { label: providerName, href: `/marketplace/${providerId}` },
    { label: apiName, href: `/marketplace/${providerId}/${apiId}` },
    {
      label: planName,
      href: `/marketplace/${providerId}/${apiId}/plans`,
    },
    {
      label: endpointPath,
      href: `/marketplace/${providerId}/${apiId}/rate-limits`,
      isCurrent: true,
    },
  ];

  return (
    <article
      className="surface"
      aria-labelledby="rlc-heading"
      style={{
        borderRadius: "var(--radius-md, 16px)",
        border: "1px solid var(--line, rgba(169,184,255,0.16))",
        padding: "24px",
        maxWidth: "640px",
      }}
    >
      {/*
       * Breadcrumb — middleEllipsis enabled so long API / plan names are
       * gracefully abbreviated at the visual level.  The default maxLen of
       * 24 characters strikes a balance between readability and space.
       * Reduced to 20 here because the card is narrower than a full page.
       */}
      <Breadcrumb
        items={breadcrumbItems}
        middleEllipsis
        middleEllipsisMaxLen={20}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <h2
            id="rlc-heading"
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 700,
              color: "var(--text)",
              lineHeight: 1.3,
            }}
          >
            Rate Limit
          </h2>

          {/* Status badge — uses colour token + short text label */}
          <span
            role="status"
            aria-label={meta.ariaLabel}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: meta.color,
              border: `1px solid ${meta.color}`,
              background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {/* Dot indicator — additional non-colour cue */}
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: meta.color,
                flexShrink: 0,
              }}
            />
            {meta.label}
          </span>
        </div>

        <p
          style={{
            margin: "6px 0 0",
            fontSize: "0.875rem",
            color: "var(--muted)",
          }}
        >
          {providerName} · {apiName}
        </p>
      </header>

      {/* ── Usage bar ──────────────────────────────────────────────────── */}
      <section aria-labelledby="rlc-quota-label">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "8px",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span
            id="rlc-quota-label"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Quota
          </span>
          <span
            className="numeric-tabular"
            style={{ fontSize: "0.875rem", color: "var(--text)", fontWeight: 600 }}
          >
            {requestsUsed.toLocaleString()} / {requestsTotal.toLocaleString()} req
          </span>
        </div>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={requestsUsed}
          aria-valuemin={0}
          aria-valuemax={requestsTotal}
          aria-label={`${requestsUsed.toLocaleString()} of ${requestsTotal.toLocaleString()} requests used`}
          style={{
            height: "8px",
            borderRadius: "999px",
            background: "var(--surface-soft, rgba(255,255,255,0.06))",
            overflow: "hidden",
            border: "1px solid var(--line, rgba(169,184,255,0.16))",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              height: "100%",
              width: `${(pct * 100).toFixed(1)}%`,
              background: meta.color,
              borderRadius: "999px",
              transition: "width 400ms ease",
            }}
          />
        </div>

        <p
          style={{
            marginTop: "8px",
            fontSize: "0.8125rem",
            color: "var(--muted)",
          }}
        >
          {(pct * 100).toFixed(1)}% used ·{" "}
          <strong style={{ color: "var(--text)" }}>
            {(requestsTotal - requestsUsed).toLocaleString()} remaining
          </strong>
        </p>
      </section>

      {/* ── Reset time ─────────────────────────────────────────────────── */}
      <footer
        style={{
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid var(--line, rgba(169,184,255,0.16))",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.8125rem",
          color: "var(--muted)",
          flexWrap: "wrap",
        }}
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Resets{" "}
        <time dateTime={resetTime.iso} style={{ color: "var(--text)", fontWeight: 600 }}>
          {resetTime.relative}
        </time>
        {" "}· Plan:{" "}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>
          {planName}
        </span>
      </footer>
    </article>
  );
}
