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
  /** Optional average cost per call (USDC). When provided, used to estimate remaining buffer runway. */
  costPerCall?: number;
  /** Average calls per day used for runway-to-days conversion. Defaults to 100. */
  callsPerDay?: number;
}

type UsageState = 'unconfigured' | 'ok' | 'warning' | 'critical' | 'exhausted';

const DEFAULT_WARNING_THRESHOLD = 75;
const DEFAULT_CRITICAL_THRESHOLD = 90;
const DEFAULT_CALLS_PER_DAY = 100;

function normalizeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCalls(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 calls';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M calls`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k calls`;
  return `${Math.round(value)} calls`;
}

function formatRunwayDays(days: number) {
  if (!Number.isFinite(days) || days <= 0) return 'Insufficient buffer';
  if (days < 1) return '< 1 day of buffer';
  if (days === 1) return '~1 day of buffer';
  if (days < 30) return `~${Math.round(days)} days of buffer`;
  const months = days / 30;
  if (months < 12) return `~${months.toFixed(1)} months of buffer`;
  const years = months / 12;
  return `~${years.toFixed(1)} years of buffer`;
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
 * When `costPerCall` is provided the component additionally estimates the
 * remaining buffer runway in terms of calls and calendar days so users can
 * top up early enough to avoid an unplanned outage.
 *
 * Part of GrantFox FWC26 (Stellar Wave) buffer top-up polish.
 */
export default function UsageGauge({
  label = 'Usage',
  used,
  limit,
  unit = 'USDC',
  warningThreshold = DEFAULT_WARNING_THRESHOLD,
  criticalThreshold = DEFAULT_CRITICAL_THRESHOLD,
  costPerCall,
  callsPerDay = DEFAULT_CALLS_PER_DAY,
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

  const safeCostPerCall = costPerCall !== undefined && Number.isFinite(costPerCall) && costPerCall > 0
    ? costPerCall
    : undefined;

  const estimatedCallsRemaining = safeCostPerCall ? remaining / safeCostPerCall : NaN;
  const estimatedDaysRemaining = safeCostPerCall && callsPerDay > 0
    ? estimatedCallsRemaining / normalizeAmount(callsPerDay)
    : NaN;

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
        <strong className="usage-gauge__percent" data-state={usageState}>{hasLimit ? `${percentUsed}%` : '—'}</strong>
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

      {safeCostPerCall && hasLimit && (
        <div className="usage-gauge__runway" aria-label="Buffer runway estimate">
          <dl>
            <div>
              <dt>Estimated calls</dt>
              <dd data-state={usageState}>{formatCalls(estimatedCallsRemaining)}</dd>
            </div>
            <div>
              <dt>Approx. runway</dt>
              <dd data-state={usageState}>{formatRunwayDays(estimatedDaysRemaining)}</dd>
            </div>
            <div>
              <dt>Cost / call</dt>
              <dd>${formatAmount(safeCostPerCall)}</dd>
            </div>
          </dl>
        </div>
      )}

      <p id={descriptionId} className="usage-gauge__sr-only">
        {accessibleDescription}
      </p>
    </section>
  );
}
