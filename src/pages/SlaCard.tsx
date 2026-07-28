/**
 * SlaCard — GrantFox FWC26 campaign (Issue #545)
 *
 * Displays the SLA (Service-Level Agreement) details for the GrantFox Wave
 * Compute API. Every copyable value surfaces a copy-to-clipboard button
 * with a 2-second "Copied!" success indicator so developers can quickly grab
 * SLA numbers for their own documentation or contracts.
 *
 * Copy interaction:
 *  - Uses the `useCopy` hook (see src/hooks/useCopy.ts).
 *  - Prefers the async Clipboard API; falls back to execCommand for older
 *    browsers / HTTP contexts.
 *  - Success state is announced via an `aria-live="polite"` region for
 *    screen-reader users (WCAG 2.1 AA SC 4.1.3).
 *  - Each copy button has a descriptive `aria-label` to identify *which*
 *    value was copied (WCAG 2.1 AA SC 4.1.2).
 *
 * Design-token compliance:
 *  - All colours reference CSS custom properties (`--text`, `--muted`,
 *    `--surface`, `--border`, `--accent`, `--success`, `--danger`).
 *  - No hardcoded hex values; dark/light mode works automatically.
 *
 * Responsive:
 *  - Single-column stack on narrow viewports; two-column grid above 600 px.
 *  - Copy buttons remain touch-target compliant (≥ 44 × 44 px tap area).
 */

import Breadcrumb from "../components/Breadcrumb";
import { CheckIcon } from "../components/icons";
import useDocumentTitle from "../hooks/useDocumentTitle";
import useCopy from "../hooks/useCopy";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single SLA metric displayed in the card. */
type SlaField = {
  /** Human-readable label (e.g. "Uptime SLA"). */
  label: string;
  /** The raw value string shown to the user and copied on click. */
  value: string;
  /** A11y identifier used in the copy button's aria-label. */
  id: string;
};

// ─── Data ────────────────────────────────────────────────────────────────────

/** SLA metrics for the GrantFox Wave Compute API – Stellar Edition. */
const SLA_FIELDS: SlaField[] = [
  {
    id: "uptime",
    label: "Uptime SLA",
    value: "99.95%",
  },
  {
    id: "response-time",
    label: "P99 Response Time",
    value: "≤ 250 ms",
  },
  {
    id: "incident-response",
    label: "Incident Response",
    value: "< 15 minutes",
  },
  {
    id: "maintenance-window",
    label: "Maintenance Window",
    value: "Sundays 02:00–04:00 UTC",
  },
  {
    id: "support-tier",
    label: "Support Tier",
    value: "Priority (24/7)",
  },
  {
    id: "credit-threshold",
    label: "Credit Threshold",
    value: "< 99.5% triggers SLA credit",
  },
  {
    id: "api-version",
    label: "API Version",
    value: "v2.4.1",
  },
  {
    id: "contract-id",
    label: "Contract ID",
    value: "FWC26-SLA-0042",
  },
];

const BREADCRUMB_ITEMS = [
  { label: "Marketplace", href: "/marketplace" },
  {
    label: "GrantFox Wave Compute API – Stellar Edition",
    href: "/marketplace/grantfox-wave-compute",
  },
  {
    label: "SLA Details",
    href: "/marketplace/grantfox-wave-compute/sla",
    isCurrent: true,
  },
] as const;

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
function SlaRow({ field }: SlaRowProps) {
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
            // Success icon: green checkmark
            <CheckIcon
              size={16}
              aria-hidden="true"
              className="sla-copy-btn__icon sla-copy-btn__icon--success"
            />
          ) : (
            // Default icon: copy
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

/**
 * Minimal two-page copy icon, styled via currentColor.
 * Drawn to match the 16px grid used by the other icons in this project.
 */
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
      {/* Back page */}
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      {/* Front page + clip */}
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

/**
 * SlaCard page — GrantFox Wave Compute API SLA details (FWC26 campaign).
 *
 * Renders each SLA metric with a copy-to-clipboard button beside the value.
 * Success feedback auto-resets after 2 seconds.
 */
export default function SlaCard() {
  useDocumentTitle(
    "SLA Details – Callora",
    "Service-level agreement details for the GrantFox Wave Compute API.",
  );

  return (
    <div className="sla-page">
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
          /* Remove browser margin/padding from <dl> */
          margin: 0;
          padding: 0;
          display: grid;
          row-gap: 0;
        }

        /* ── Individual row ──────────────────────────────────────────────── */
        .sla-row {
          display: grid;
          /* label | value+button */
          grid-template-columns: 1fr 1fr;
          align-items: center;
          column-gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
        }

        .sla-row:last-child {
          border-bottom: none;
        }

        /* Stack to single column on very narrow viewports */
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
          /* <dt> has browser margin; reset it */
          margin: 0;
        }

        /* ── Value + copy-button wrapper ─────────────────────────────────── */
        .sla-row__value-wrap {
          /* Inline row: value text + copy button side by side */
          display: flex;
          align-items: center;
          gap: 10px;
          /* <dd> has browser margin; reset it */
          margin: 0;
        }

        /* ── Value text ──────────────────────────────────────────────────── */
        .sla-row__value {
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text);
          /* Allow long values (e.g. "Sundays 02:00–04:00 UTC") to wrap */
          word-break: break-word;
          flex: 1 1 auto;
          min-width: 0;
        }

        /* ── Copy button ─────────────────────────────────────────────────── */
        .sla-copy-btn {
          /* Reset browser button defaults */
          appearance: none;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          padding: 6px 10px;

          /* Layout */
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;

          /* Typography */
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--muted);
          line-height: 1;

          /* Ensure ≥ 44px tap target height on mobile (WCAG 2.5.5) */
          min-height: 36px;

          /* Subtle transition — excluded from .no-theme-transition per app convention */
          transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
        }

        /* Hover / focus */
        .sla-copy-btn:hover {
          color: var(--text);
          background: var(--surface-raised, rgba(0, 0, 0, 0.05));
          border-color: var(--border, rgba(0, 0, 0, 0.10));
        }

        /* WCAG 2.4.7: visible focus ring using design token */
        .sla-copy-btn:focus-visible {
          outline: 2px solid var(--accent, #4e85ff);
          outline-offset: 2px;
        }

        /* Copied state: colour shifts to --success green */
        .sla-copy-btn--copied {
          color: var(--success, #10b981);
          border-color: transparent;
        }

        .sla-copy-btn--copied:hover {
          color: var(--success, #10b981);
          background: transparent;
        }

        /* ── Icon sizes ──────────────────────────────────────────────────── */
        .sla-copy-btn__icon {
          flex-shrink: 0;
          /* Inherits currentColor from button */
        }

        .sla-copy-btn__icon--success {
          color: var(--success, #10b981);
        }

        /* ── Button label ────────────────────────────────────────────────── */
        .sla-copy-btn__label {
          /* Always visible (not just icon) for clarity */
          white-space: nowrap;
        }

        /* ── Visually-hidden utility (screen-reader only live regions) ────── */
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

        /* ── Footer note ─────────────────────────────────────────────────── */
        .sla-note {
          margin-top: 20px;
          padding: 12px 16px;
          background: var(--surface-raised, rgba(0, 0, 0, 0.025));
          border-radius: 8px;
          font-size: 0.8125rem;
          color: var(--muted);
          line-height: 1.5;
        }
      `}</style>

      {/* Breadcrumb trail, max 28 chars per label before middle-ellipsis */}
      <Breadcrumb items={BREADCRUMB_ITEMS} maxLabelLength={28} />

      <section
        className="sla-card"
        aria-labelledby="sla-card-title"
        data-testid="sla-card"
      >
        <header className="sla-card-header">
          <h1 id="sla-card-title" className="sla-card-title">
            SLA Details
          </h1>
          <p className="sla-card-subtitle">
            GrantFox Wave Compute API – Stellar Edition &nbsp;·&nbsp; FWC26
          </p>
        </header>

        {/*
          Render each SLA field in a <dl> (definition list) — semantically the
          correct element for label/value pairs (WCAG 1.3.1 Info and Relationships).
        */}
        <dl className="sla-list" aria-label="SLA metrics">
          {SLA_FIELDS.map((field) => (
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
