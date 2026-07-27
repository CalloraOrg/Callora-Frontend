/**
 * StatusBadge — color-blind-safe status indicator.
 *
 * Combines a color token (--sb-<status>-bg/fg/border) with a unique SVG
 * background pattern (defined in src/styles/patterns.css) so that each
 * status is distinguishable by texture as well as by color.  This satisfies
 * WCAG 1.4.1 (Use of Color) and helps users with deuteranopia/protanopia.
 *
 * Usage:
 *   <StatusBadge status="operational" />
 *   <StatusBadge status="error" label="API Error" />
 *
 * Props:
 *   status  — one of the six supported variants (see StatusVariant below)
 *   label   — optional override for the visible text; defaults to the
 *             capitalised status name
 *   className — passed through to the root element for layout composition
 */

import React from 'react';

/** All supported status variants. */
export type StatusVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'operational'
  | 'degraded'
  | 'down'
  | 'pending'
  | 'maintenance';

const DEFAULT_LABELS: Record<StatusVariant, string> = {
  success: 'Operational',
  operational: 'Operational',
  error: 'Error',
  down: 'Down',
  warning: 'Degraded',
  degraded: 'Degraded',
  pending: 'Pending',
  maintenance: 'Maintenance',
};

const PATTERN_DESCRIPTIONS: Record<StatusVariant, string> = {
  success: 'solid baseline',
  operational: 'solid baseline',
  error: 'diagonal stripes',
  down: 'diagonal stripes',
  warning: 'opposite diagonal stripes',
  degraded: 'opposite diagonal stripes',
  pending: 'dot pattern',
  maintenance: 'dot pattern',
};

const PATTERN_KEYS: Record<StatusVariant, string> = {
  success: 'baseline',
  operational: 'baseline',
  error: 'stripes',
  down: 'stripes',
  warning: 'opposite-stripes',
  degraded: 'opposite-stripes',
  pending: 'dots',
  maintenance: 'dots',
};

/** Small circle indicator rendered before the text label. */
function Dot({ status }: { status: StatusVariant }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '0.5em',
        height: '0.5em',
        borderRadius: '50%',
        backgroundColor: `var(--sb-${status}-fg)`,
        flexShrink: 0,
      }}
    />
  );
}

type Props = {
  status: StatusVariant;
  /** Override the visible label; defaults to a human-readable status name. */
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: Props) {
  const visibleLabel = label ?? DEFAULT_LABELS[status];
  const patternDescription = PATTERN_DESCRIPTIONS[status];
  const patternKey = PATTERN_KEYS[status];

  return (
    <span
      // Pattern class from patterns.css provides the texture overlay
      className={[`sb-pattern-${status}`, className].filter(Boolean).join(' ')}
      data-status={status}
      data-pattern={patternKey}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375em',
        padding: '0.2em 0.6em',
        borderRadius: '0.375em',
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '0.02em',
        backgroundColor: `var(--sb-${status}-bg)`,
        color: `var(--sb-${status}-fg)`,
        border: `1px solid var(--sb-${status}-border)`,
        // Ensure the pattern SVG uses the foreground color
        // (SVG uses `currentColor` for strokes/fills)
        whiteSpace: 'nowrap',
      }}
      // Expose status semantically; the visible text already conveys it but
      // role="status" would be too assertive for a static badge.
      role="img"
      aria-label={visibleLabel}
      aria-description={`Pattern-based status badge: ${visibleLabel} with ${patternDescription}`}
    >
      <Dot status={status} />
      {visibleLabel}
    </span>
  );
}

export default StatusBadge;
