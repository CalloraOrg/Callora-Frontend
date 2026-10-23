/**
 * SlaCard.tsx
 *
 * Per-API Service-Level Agreement (SLA) page.
 *
 * Resolves the target API from the marketplace catalogue (using fetchCatalog)
 * based on the :apiId route parameter.
 *
 * States supported:
 *  1. Loading: Skeleton placeholder with aria-busy="true".
 *  2. Unknown ID: Announced not-found panel with link back to the Marketplace.
 *  3. API without SLA: Clear "This provider has not published an SLA" banner
 *     with observed uptime and latency metrics (distinct from contractual terms).
 *  4. API with SLA: Contractual SLA metrics (uptime, latency, maintenance, etc.)
 *     with copy-to-clipboard buttons per value and aria-live announcements.
 */

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import { CheckIcon } from "../components/icons";
import useDocumentTitle from "../hooks/useDocumentTitle";
import useCopy from "../hooks/useCopy";
import { fetchCatalog, isCatalogAbortError } from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single SLA or observed metric displayed in the card. */
export type SlaField = {
  /** Human-readable label (e.g. "Uptime SLA" or "Observed Uptime"). */
  label: string;
  /** The raw value string shown to the user and copied on click. */
  value: string;
  /** A11y identifier used in data-testid and the copy button's aria-label. */
  id: string;
};

// ─── Sub-component: a single SLA row with its copy button ────────────────────

type SlaRowProps = {
  field: SlaField;
};

/**
 * SlaRow — renders one label / value pair with a copy-to-clipboard button.
 *
 * Each row manages its own `useCopy` instance so that the "Copied!" feedback
 * is scoped to the individual button that was clicked.
 */
export function SlaRow({ field }: SlaRowProps) {
  const { copied, handleCopy } = useCopy();

  return (
    <div className="sla-row" data-testid={`sla-row-${field.id}`}>
      {/* Live region announces copy outcome to screen readers */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid={`sla-live-${field.id}`}
      >
        {copied ? `${field.label} copied to clipboard` : ""}
      </span>

      <dt className="sla-row__label">{field.label}</dt>

      <dd className="sla-row__value-wrap">
        <span
          className="sla-row__value"
          data-testid={`sla-value-${field.id}`}
        >
          {field.value}
        </span>

        <button
          type="button"
          className={`sla-copy-btn${copied ? " sla-copy-btn--copied" : ""}`}
          aria-label={
            copied
              ? `${field.label} copied`
              : `Copy ${field.label}: ${field.value}`
          }
          onClick={() => handleCopy(field.value)}
          data-testid={`sla-copy-btn-${field.id}`}
        >
          {copied ? (
            <CheckIcon
              size={16}
              aria-hidden="true"
              className="sla-copy-btn__icon sla-copy-btn__icon--success"
            />
          ) : (
            <CopyIcon aria-hidden="true" className="sla-copy-btn__icon" />
          )}
          <span className="sla-copy-btn__label">
            {copied ? "Copied!" : "Copy"}
          </span>
        </button>
      </dd>
    </div>
  );
}

// ─── Inline SVG copy icon (avoids an external icon dependency) ───────────────

function CopyIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function SlaCard({ apiId: propApiId }: { apiId?: string } = {}) {
  const { apiId: routeApiId } = useParams<{ apiId: string }>();
  const apiId = propApiId ?? routeApiId;

  const [api, setApi] = useState<APIItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const controller = new AbortController();

    fetchCatalog(controller.signal)
      .then((apis) => {
        if (!isMounted) return;
        const found = apis.find((a) => a.id === apiId);
        setApi(found ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted || isCatalogAbortError(err)) return;
        setApi(null);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiId]);

  useDocumentTitle(
    loading
      ? "Loading SLA Details – Callora"
      : api
        ? `${api.name} SLA Details – Callora`
        : "API Not Found – Callora",
    api
      ? `Service-level agreement details for ${api.name}.`
      : "SLA details.",
  );

  const sharedStyles = (
    <style>{`
      /* ── Layout ──────────────────────────────────────────────────────── */
      .sla-page {
        padding: 0 32px 48px;
        max-width: 860px;
        margin: 0 auto;
      }

      /* ── Card container ──────────────────────────────────────────────── */
      .sla-card {
        background: var(--surface);
        border: 1px solid var(--border, rgba(0, 0, 0, 0.10));
        border-radius: 12px;
        padding: 32px;
      }

      /* ── Card header ─────────────────────────────────────────────────── */
      .sla-card-header {
        margin-bottom: 28px;
      }

      .sla-card-title {
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--text);
        margin: 0 0 6px;
      }

      .sla-card-subtitle {
        font-size: 0.875rem;
        color: var(--muted);
        margin: 0;
      }

      /* ── Definition list grid ────────────────────────────────────────── */
      .sla-list {
        margin: 0;
        padding: 0;
        display: grid;
        row-gap: 0;
      }

      /* ── Individual row ──────────────────────────────────────────────── */
      .sla-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        column-gap: 16px;
        padding: 14px 0;
        border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
      }

      .sla-row:last-child {
        border-bottom: none;
      }

      @media (max-width: 480px) {
        .sla-row {
          grid-template-columns: 1fr;
          row-gap: 6px;
        }
      }

      /* ── Label ───────────────────────────────────────────────────────── */
      .sla-row__label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--muted);
        margin: 0;
      }

      /* ── Value + copy-button wrapper ─────────────────────────────────── */
      .sla-row__value-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
      }

      /* ── Value text ──────────────────────────────────────────────────── */
      .sla-row__value {
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--text);
        word-break: break-word;
        flex: 1 1 auto;
        min-width: 0;
      }

      /* ── Copy button ─────────────────────────────────────────────────── */
      .sla-copy-btn {
        appearance: none;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        padding: 6px 10px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--muted);
        line-height: 1;
        min-height: 36px;
        transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
      }

      .sla-copy-btn:hover {
        color: var(--text);
        background: var(--surface-raised, rgba(0, 0, 0, 0.05));
        border-color: var(--border, rgba(0, 0, 0, 0.10));
      }

      .sla-copy-btn:focus-visible {
        outline: 2px solid var(--accent, #4e85ff);
        outline-offset: 2px;
      }

      .sla-copy-btn--copied {
        color: var(--success, #10b981);
        border-color: transparent;
      }

      .sla-copy-btn--copied:hover {
        color: var(--success, #10b981);
        background: transparent;
      }

      .sla-copy-btn__icon {
        flex-shrink: 0;
      }

      .sla-copy-btn__icon--success {
        color: var(--success, #10b981);
      }

      .sla-copy-btn__label {
        white-space: nowrap;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }

      .sla-note {
        margin-top: 20px;
        padding: 12px 16px;
        background: var(--surface-raised, rgba(0, 0, 0, 0.025));
        border-radius: 8px;
        font-size: 0.8125rem;
        color: var(--muted);
        line-height: 1.5;
      }

      /* ── Skeleton ────────────────────────────────────────────────────── */
      .sla-skeleton-line {
        background: var(--border, rgba(120, 120, 120, 0.15));
        border-radius: 4px;
        animation: sla-pulse 1.5s ease-in-out infinite;
      }

      @keyframes sla-pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 0.3; }
      }
    `}</style>
  );

  // 1. Loading state
  if (loading) {
    return (
      <div className="sla-page" data-testid="sla-skeleton" aria-busy="true" aria-live="polite">
        {sharedStyles}
        <div className="sla-card" style={{ marginTop: "32px" }}>
          <div className="sla-card-header">
            <div className="sla-skeleton-line" style={{ width: "240px", height: "28px", marginBottom: "8px" }} />
            <div className="sla-skeleton-line" style={{ width: "160px", height: "16px" }} />
          </div>
          <div className="sla-list">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="sla-row">
                <div className="sla-skeleton-line" style={{ width: "130px", height: "16px" }} />
                <div className="sla-skeleton-line" style={{ width: "100px", height: "16px" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Not found state
  if (!api) {
    return (
      <div className="sla-page">
        {sharedStyles}
        <Breadcrumb
          items={[
            { label: "Marketplace", href: "/marketplace" },
            { label: "API Not Found", href: "#", isCurrent: true },
          ]}
          maxLabelLength={28}
        />
        <section
          className="sla-card"
          role="alert"
          aria-labelledby="sla-not-found-title"
          data-testid="sla-not-found"
        >
          <header className="sla-card-header">
            <h1 id="sla-not-found-title" className="sla-card-title">
              API Not Found
            </h1>
            <p className="sla-card-subtitle">
              The requested API could not be found in the catalogue.
            </p>
          </header>
          <div style={{ marginTop: "24px" }}>
            <Link
              to="/marketplace"
              className="primary-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 16px",
                borderRadius: "6px",
                background: "var(--accent, #4e85ff)",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              Back to Marketplace
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: "Marketplace", href: "/marketplace" },
    { label: api.name, href: `/details/${api.id}` },
    { label: "SLA", href: `/marketplace/${api.id}/sla`, isCurrent: true },
  ];

  // 3. API without SLA
  if (!api.sla) {
    const observedFields: SlaField[] = [
      {
        id: "observed-uptime",
        label: "Observed Uptime",
        value: api.uptimePercent !== undefined ? `${api.uptimePercent}%` : "Not available",
      },
      {
        id: "observed-latency",
        label: "Observed Average Latency",
        value: api.avgLatencyMs !== undefined ? `${api.avgLatencyMs} ms` : "Not available",
      },
    ];
    if (api.version) {
      observedFields.push({
        id: "api-version",
        label: "API Version",
        value: api.version,
      });
    }

    return (
      <div className="sla-page">
        {sharedStyles}
        <Breadcrumb items={breadcrumbItems} maxLabelLength={28} />

        <section
          className="sla-card"
          aria-labelledby="sla-card-title"
          data-testid="sla-card"
        >
          <header className="sla-card-header">
            <h1 id="sla-card-title" className="sla-card-title">
              {api.name} SLA Details
            </h1>
            <p className="sla-card-subtitle">
              {api.name} &nbsp;·&nbsp; {api.provider?.name ?? "Provider"}
            </p>
          </header>

          <div
            className="sla-no-sla-banner"
            data-testid="sla-not-published-banner"
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              background: "var(--surface-raised, rgba(0, 0, 0, 0.03))",
              border: "1px solid var(--border, rgba(0, 0, 0, 0.08))",
              marginBottom: "24px",
            }}
          >
            <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text)" }}>
              This provider has not published an SLA
            </p>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>
              The metrics below represent observed telemetry across recent requests. These figures are observed and not contractual commitments.
            </p>
          </div>

          <dl className="sla-list" aria-label="Observed metrics">
            {observedFields.map((field) => (
              <SlaRow key={field.id} field={field} />
            ))}
          </dl>

          <p className="sla-note">
            These figures are observed metrics from platform telemetry and do not constitute a contractual SLA.
          </p>
        </section>
      </div>
    );
  }

  // 4. API with SLA
  const fields: SlaField[] = [];

  if (api.sla.uptimeTargetPct !== undefined) {
    fields.push({
      id: "uptime",
      label: "Uptime SLA",
      value: `${api.sla.uptimeTargetPct}%`,
    });
  }

  if (api.sla.p99LatencyMs !== undefined) {
    fields.push({
      id: "response-time",
      label: "P99 Response Time",
      value: `≤ ${api.sla.p99LatencyMs} ms`,
    });
  }

  if (api.sla.incidentResponseMinutes !== undefined) {
    fields.push({
      id: "incident-response",
      label: "Incident Response",
      value: `< ${api.sla.incidentResponseMinutes} minutes`,
    });
  }

  if (api.sla.maintenanceWindow) {
    fields.push({
      id: "maintenance-window",
      label: "Maintenance Window",
      value: api.sla.maintenanceWindow,
    });
  }

  if (api.sla.supportTier) {
    fields.push({
      id: "support-tier",
      label: "Support Tier",
      value: api.sla.supportTier,
    });
  }

  if (api.sla.creditThresholdPct !== undefined) {
    fields.push({
      id: "credit-threshold",
      label: "Credit Threshold",
      value: `< ${api.sla.creditThresholdPct}% triggers SLA credit`,
    });
  }

  if (api.version) {
    fields.push({
      id: "api-version",
      label: "API Version",
      value: api.version,
    });
  }

  return (
    <div className="sla-page">
      {sharedStyles}
      <Breadcrumb items={breadcrumbItems} maxLabelLength={28} />

      <section
        className="sla-card"
        aria-labelledby="sla-card-title"
        data-testid="sla-card"
      >
        <header className="sla-card-header">
          <h1 id="sla-card-title" className="sla-card-title">
            {api.name} SLA Details
          </h1>
          <p className="sla-card-subtitle">
            {api.name} &nbsp;·&nbsp; {api.provider?.name ?? "Provider"}
          </p>
        </header>

        <dl className="sla-list" aria-label="SLA metrics">
          {fields.map((field) => (
            <SlaRow key={field.id} field={field} />
          ))}
        </dl>

        <p className="sla-note">
          SLA credits are calculated on a rolling monthly basis. Scheduled
          maintenance windows are excluded from uptime calculations. Contact
          the support portal for custom enterprise SLA terms.
        </p>
      </section>
    </div>
  );
}
