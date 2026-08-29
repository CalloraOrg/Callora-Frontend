/**
 * PreviewCard.tsx — Hover and focus preview card component.
 *
 * GrantFox FWC26 campaign requirement:
 * - Issue #689: Hover-triggered preview on DashboardOverview rows/cards.
 * - Issue #FWC26: Hover-triggered preview on BillingHistory transaction rows,
 *   surfacing on-chain details (tx hash, network, confirmations, tx type)
 *   without navigating away.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The trigger receives `aria-describedby` pointing at the preview panel
 *   while open, satisfying WCAG 1.3.1 (Info and Relationships).
 * - The preview card has `role="tooltip"` so assistive technology announces
 *   it as supplementary information rather than as a live region.
 * - Pressing `Escape` closes the preview card cleanly and returns focus to
 *   the trigger (WCAG 2.1.1 Keyboard, 2.4.3 Focus Order).
 * - `pointer-events: none` on the panel prevents mouse trapping.
 * - All colours reference CSS custom properties (design tokens) so both
 *   light and dark themes are covered automatically (WCAG 1.4.3 Contrast).
 */

import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
  type FocusEvent,
} from 'react';
import StatusBadge, { type StatusVariant } from './StatusBadge';

// ── Shared metric type ────────────────────────────────────────────────────────

export interface PreviewMetric {
  label: string;
  value: string | number;
}

// ── PreviewCardData ───────────────────────────────────────────────────────────
// The data shape used by PreviewCard.  All billing-specific fields are optional
// so existing dashboard callers are not affected.

export interface PreviewCardData {
  /** Unique row/item ID used as a React key. */
  id: string;

  // ── Common fields (Dashboard overview & Billing history) ──────────────────

  title: string;
  subtitle?: string;
  category?: string;
  status?: StatusVariant;
  description?: string;
  metrics?: PreviewMetric[];
  tags?: string[];
  price?: string | number;
  lastActive?: string;
  /** Arbitrary key/value pairs rendered as a compact detail list. */
  details?: Record<string, string | number>;

  // ── Billing-specific fields (Issue FWC26) ─────────────────────────────────

  /**
   * Full 64-character Stellar transaction hash.
   * Displayed truncated (first 8 … last 6 chars) with a copy hint.
   */
  txHash?: string;

  /**
   * Blockchain / ledger network name, e.g. "Stellar Mainnet", "Stellar Testnet".
   */
  network?: string;

  /**
   * Number of ledger confirmations at the time the data was fetched.
   * Shown as a numeric badge.
   */
  confirmations?: number;

  /**
   * High-level billing transaction type.
   * Examples: "Deposit", "API Call", "Refund", "Settlement", "Fee"
   */
  type?: string;

  /**
   * ISO 8601 timestamp string for when the transaction was recorded.
   * Displayed in a human-readable locale format.
   */
  timestamp?: string;

  /**
   * Amount of USDC involved in the transaction.
   * Pass as a numeric value; the card formats it with 2 decimal places.
   */
  amount?: number;

  /**
   * Direction of the transaction from the user's perspective.
   * Controls colour: credit (positive) = success green; debit = danger red.
   */
  direction?: 'credit' | 'debit';
}

// ── PreviewCardProps ──────────────────────────────────────────────────────────

export interface PreviewCardProps {
  /** The item details to present in the preview card overlay. */
  data: PreviewCardData;
  /** Content acting as the hover/focus trigger. */
  children: ReactNode;
  /** Floating overlay placement relative to the trigger element. */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional additional class name for the wrapper element. */
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Truncate a transaction hash for compact display.
 * "abcdefgh...xyz" where the prefix is 8 chars and suffix is 6.
 */
function truncateTxHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/**
 * Format a numeric USDC amount with exactly 2 decimal places.
 * Uses Intl.NumberFormat for locale-aware thousands separators.
 */
function formatUsdcAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format an ISO 8601 timestamp into a human-readable string.
 * Falls back to the raw string if parsing fails.
 */
function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PreviewCard({
  data,
  children,
  position = 'bottom',
  className = '',
}: PreviewCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);

  /**
   * When the user presses Escape we programmatically re-focus the trigger.
   * This flag prevents the subsequent focus event from immediately re-opening
   * the panel.
   */
  const suppressNextFocus = useRef(false);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      suppressNextFocus.current = true;
      hide();
      triggerRef.current?.focus();
    }
  };

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'top':
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
        };
      case 'left':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: '8px',
        };
      case 'right':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '8px',
        };
      case 'bottom':
      default:
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
        };
    }
  };

  // Detect billing mode: if any billing-specific field is present we render
  // the billing-oriented section instead of the generic footer.
  const isBillingCard =
    data.txHash !== undefined ||
    data.network !== undefined ||
    data.confirmations !== undefined ||
    data.type !== undefined ||
    data.amount !== undefined;

  return (
    <div
      className={['preview-card__wrapper', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <div
        ref={triggerRef}
        className="preview-card__trigger"
        aria-describedby={open ? panelId : undefined}
        onFocus={() => {
          if (suppressNextFocus.current) {
            suppressNextFocus.current = false;
            return;
          }
          show();
        }}
        onBlur={(e: FocusEvent<HTMLDivElement>) => {
          // Only close when focus has left the entire wrapper subtree.
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            hide();
          }
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Preview details for ${data.title}`}
        style={{ cursor: 'pointer', outline: 'none' }}
      >
        {children}
      </div>

      {/* ── Preview panel ───────────────────────────────────────────────── */}
      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="preview-card__panel surface"
          aria-label={`${data.title} preview`}
          style={{
            position: 'absolute',
            zIndex: 1000,
            width: '300px',
            maxWidth: '90vw',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--surface, #1e1e2e)',
            border:
              '1px solid var(--border-color, var(--line, rgba(255, 255, 255, 0.15)))',
            boxShadow: 'var(--shadow, 0 10px 30px rgba(0, 0, 0, 0.3))',
            color: 'var(--text-primary, var(--text, #f9fafb))',
            pointerEvents: 'none',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            ...getPositionStyles(),
          }}
        >
          {/* Header: title + status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '6px',
            }}
          >
            <strong
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-primary, var(--text, #ffffff))',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {data.title}
            </strong>
            {data.status && <StatusBadge status={data.status} />}
          </div>

          {/* Subtitle / Category */}
          {(data.subtitle || data.category) && (
            <p
              style={{
                margin: '0 0 6px 0',
                fontSize: '0.75rem',
                color: 'var(--text-secondary, var(--muted, #9ca3af))',
              }}
            >
              {data.subtitle ?? data.category}
            </p>
          )}

          {/* Description */}
          {data.description && (
            <p
              style={{
                margin: '0 0 8px 0',
                fontSize: '0.75rem',
                color: 'var(--text-secondary, var(--muted, #cbd5e1))',
              }}
            >
              {data.description}
            </p>
          )}

          {/* ── Billing-specific section (FWC26) ───────────────────────── */}
          {isBillingCard && (
            <div
              style={{
                margin: '8px 0',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-chip, rgba(255, 255, 255, 0.04))',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              {/* Transaction type + direction badge */}
              {data.type && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Type</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-primary, #f9fafb)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {data.type}
                    {data.direction && (
                      <span
                        aria-label={data.direction === 'credit' ? 'incoming' : 'outgoing'}
                        style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          backgroundColor:
                            data.direction === 'credit'
                              ? 'var(--sb-success-bg, rgba(115, 242, 187, 0.14))'
                              : 'var(--sb-error-bg, rgba(255, 125, 141, 0.14))',
                          color:
                            data.direction === 'credit'
                              ? 'var(--sb-success-fg, #73f2bb)'
                              : 'var(--sb-error-fg, #ff7d8d)',
                        }}
                      >
                        {data.direction === 'credit' ? '↑ credit' : '↓ debit'}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Amount */}
              {data.amount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Amount</span>
                  <strong
                    className="tabular-nums numeric-tabular"
                    style={{
                      color:
                        data.direction === 'credit'
                          ? 'var(--success, #10b981)'
                          : data.direction === 'debit'
                            ? 'var(--danger, #ef4444)'
                            : 'var(--accent, #6366f1)',
                    }}
                  >
                    {data.direction === 'credit' ? '+' : data.direction === 'debit' ? '−' : ''}
                    {formatUsdcAmount(data.amount)} USDC
                  </strong>
                </div>
              )}

              {/* Network */}
              {data.network && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Network</span>
                  <span style={{ color: 'var(--text-primary, #f9fafb)' }}>{data.network}</span>
                </div>
              )}

              {/* Confirmations */}
              {data.confirmations !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Confirmations</span>
                  <span
                    className="tabular-nums"
                    style={{
                      color:
                        data.confirmations >= 10
                          ? 'var(--success, #10b981)'
                          : 'var(--accent, #6366f1)',
                      fontWeight: 600,
                    }}
                  >
                    {data.confirmations}
                  </span>
                </div>
              )}

              {/* Transaction hash */}
              {data.txHash && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Tx hash</span>
                  <code
                    className="tabular-nums"
                    title={data.txHash}
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--accent, #6366f1)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {truncateTxHash(data.txHash)}
                  </code>
                </div>
              )}

              {/* Timestamp */}
              {data.timestamp && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Time</span>
                  <time
                    dateTime={data.timestamp}
                    style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '0.7rem' }}
                  >
                    {formatTimestamp(data.timestamp)}
                  </time>
                </div>
              )}
            </div>
          )}

          {/* ── Generic metrics grid (non-billing, Dashboard overview) ─── */}
          {!isBillingCard && data.metrics && data.metrics.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                margin: '8px 0',
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-chip, rgba(255, 255, 255, 0.04))',
              }}
            >
              {data.metrics.map((m) => (
                <div key={m.label} style={{ fontSize: '0.7rem' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)', display: 'block' }}>
                    {m.label}
                  </span>
                  <strong
                    className="tabular-nums numeric-tabular"
                    style={{ color: 'var(--accent, #6366f1)' }}
                  >
                    {m.value}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {/* Tags (common to both modes) */}
          {data.tags && data.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-chip, rgba(255, 255, 255, 0.08))',
                    color: 'var(--text-secondary, #cbd5e1)',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer: price / last-active (non-billing only) */}
          {!isBillingCard && (data.price !== undefined || data.lastActive) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
                fontSize: '0.7rem',
                color: 'var(--text-secondary, #9ca3af)',
              }}
            >
              {data.price !== undefined && (
                <span
                  className="tabular-nums numeric-tabular"
                  style={{ color: 'var(--success, #10b981)', fontWeight: 600 }}
                >
                  {typeof data.price === 'number' ? `$${data.price} / call` : data.price}
                </span>
              )}
              {data.lastActive && <span>Last active: {data.lastActive}</span>}
            </div>
          )}

          {/* Escape-key hint */}
          <p
            style={{
              margin: '8px 0 0',
              paddingTop: '6px',
              borderTop: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
              fontSize: '0.65rem',
              color: 'var(--text-secondary, #6b7280)',
              textAlign: 'right',
            }}
          >
            Press <kbd style={{ fontFamily: 'monospace' }}>Esc</kbd> to close
          </p>
        </div>
      )}
    </div>
  );
}

export default PreviewCard;
