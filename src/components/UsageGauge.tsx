import { useId } from 'react';

export interface UsageGaugeProps {
  /** Accessible and visible label for the usage metric being tracked. */
  label?: string;
  /** Amount already consumed. Negative and non-finite values are treated as 0. */
  used: number;
  /** Maximum amount available for the period. Values <= 0 render an unconfigured state. */
  limit: number;
  /** Unit appended to visible and assistive text, for example "USDC" or "calls". */
  unit?: string;
  /** Percentage at which the gauge moves into the warning state. */
  warningThreshold?: number;
  /** Percentage at which the gauge moves into the critical state. */
  criticalThreshold?: number;
  /** Optional estimated unit cost per API call – used to calculate "call runway" buffer estimate. */
  estCostPerCall?: number;
  /** When true, displays the "Buffer remaining" runway estimate below the meta row (requires limit). */
  showRunway?: boolean;
}

type UsageState = 'unconfigured' | 'ok' | 'warning' | 'critical' | 'exhausted';

const DEFAULT_WARNING_THRESHOLD = 75;
const DEFAULT_CRITICAL_THRESHOLD = 90;

function normalizeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRunway(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function getUsageState(percentUsed: number, hasLimit: boolean, warningThreshold: number, criticalThreshold: number): UsageState {
  if (!hasLimit) return 'unconfigured';
  if (percentUsed >= 100) return 'exhausted';
  if (percentUsed >= criticalThreshold) return 'critical';
  if (percentUsed >= warningThreshold) return 'warning';
  return 'ok';
}

const stateLabels: Record<UsageState, string> = {
  unconfigured: 'No limit configured',
  ok: 'Within limit',
  warning: 'Approaching limit',
  critical: 'Critical usage',
  exhausted: 'Limit reached',
};

/**
 * UsageGauge summarizes consumed API budget with a visual bar and complete
 * screen-reader text. The progressbar exposes numeric ARIA values while the
 * companion description announces the human-readable usage state and remaining
 * allowance for assistive technology users.
 *
 * Stellar Wave enhancement (FWC26): when `showRunway` + `estCostPerCall` are
 * provided, an extra "Buffer remaining / Estimated call runway" row renders
 * below the meta text so teams can translate USDC balance into tangible
 * "number of calls" runway.
 */
export default function UsageGauge({
  label = 'Usage',
  used,
  limit,
  unit = 'USDC',
  warningThreshold = DEFAULT_WARNING_THRESHOLD,
  criticalThreshold = DEFAULT_CRITICAL_THRESHOLD,
  estCostPerCall,
  showRunway = false,
}: UsageGaugeProps) {
  const titleId = useId();
  const descriptionId = useId();
  const safeUsed = normalizeAmount(used);
  const safeLimit = normalizeAmount(limit);
  const hasLimit = safeLimit > 0;
  const rawPercent = hasLimit ? (safeUsed / safeLimit) * 100 : 0;
  const percentUsed = Math.round(rawPercent);
  const clampedPercent = Math.min(Math.max(rawPercent, 0), 100);
  const remaining = hasLimit ? Math.max(safeLimit - safeUsed, 0) : 0;
  const safeWarningThreshold = Math.min(Math.max(warningThreshold, 0), 100);
  const safeCriticalThreshold = Math.min(Math.max(criticalThreshold, safeWarningThreshold), 100);
  const usageState = getUsageState(percentUsed, hasLimit, safeWarningThreshold, safeCriticalThreshold);
  const formattedUsed = formatAmount(safeUsed);
  const formattedLimit = formatAmount(safeLimit);
  const formattedRemaining = formatAmount(remaining);

  const hasRunwayInfo = Boolean(showRunway && estCostPerCall != null && estCostPerCall > 0 && hasLimit);
  const estimatedCalls = hasRunwayInfo
    ? Math.max(Math.floor(remaining / estCostPerCall), 0)
    : 0;

  const accessibleDescription = hasLimit
    ? `${stateLabels[usageState]}: ${formattedUsed} of ${formattedLimit} ${unit} used, ${formattedRemaining} ${unit} remaining, ${percentUsed}% used.`
    : `${stateLabels[usageState]}: ${formattedUsed} ${unit} used. Add a usage limit to track remaining allowance.`;

  return (
    <section className="usage-gauge" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="usage-gauge__header">
        <div>
          <h3 id={titleId} className="eyebrow usage-gauge__title">
            {label}
          </h3>
          <p className="usage-gauge__status" data-state={usageState}>
            {stateLabels[usageState]}
          </p>
        </div>
        <strong className="usage-gauge__percent">{hasLimit ? `${percentUsed}%` : '—'}</strong>
      </div>

      <div
        className="usage-gauge__track"
        role="progressbar"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasLimit ? Math.min(Math.max(percentUsed, 0), 100) : 0}
        aria-valuetext={accessibleDescription}
      >
        <span
          className="usage-gauge__fill"
          data-state={usageState}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>

      <p className="usage-gauge__meta" aria-hidden="true">
        {hasLimit
          ? `${formattedUsed} of ${formattedLimit} ${unit} used · ${formattedRemaining} ${unit} remaining`
          : `${formattedUsed} ${unit} used · Set a limit to track remaining allowance`}
      </p>

      {hasRunwayInfo && (
        <div className="usage-gauge__runway" data-state={usageState}>
          <span className="usage-gauge__runway-label">
            Buffer remaining
          </span>
          <span className="usage-gauge__runway-value">
            ≈ <strong>{formatRunway(estimatedCalls)}</strong> calls
            <span className="usage-gauge__runway-hint">
              {' '}@ ~${estCostPerCall.toFixed(3)} / call
            </span>
          </span>
        </div>
      )}

      <p id={descriptionId} className="usage-gauge__sr-only">
        {accessibleDescription}
        {hasRunwayInfo
          ? ` Buffer remaining: approximately ${formatRunway(estimatedCalls)} calls at ${estCostPerCall.toFixed(3)} dollars per call.`
          : ''}
      </p>
    </section>
  );
}
