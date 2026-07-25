import React from 'react';
import { WarningIcon } from './icons/WarningIcon';

interface PlanNudgeProps {
  /** Quota usage as a number from 0–100. Banner only renders at >=80. */
  usagePercent: number;
  /** Called when the user dismisses the banner. */
  onDismiss: () => void;
  /** Optional callback for upgrade action; defaults to navigating to /billing/upgrade. */
  onUpgrade?: () => void;
}

/**
 * PlanNudge – a theme-aware, WCAG 2.1 AA compliant upgrade nudge banner.
 *
 * Displays at >=80% quota usage and is hidden when dismissed (for 24h via
 * the useQuota hook in the parent). Shows a distinct message at >=95%.
 *
 * Uses CSS design tokens (not inline hex) per the Callora UI Design System.
 */
export default function PlanNudge({ usagePercent, onDismiss, onUpgrade }: PlanNudgeProps) {
  // Only render at the >=80% threshold
  if (usagePercent < 80) return null;

  const isCritical = usagePercent >= 95;
  const variant = isCritical ? 'critical' : 'warning';

  const label = isCritical
    ? `Critical: you've used ${usagePercent}% of your plan quota. Upgrade now to avoid service interruptions.`
    : `Heads up: you've used ${usagePercent}% of your plan quota. Consider upgrading your plan.`;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.location.href = '/billing/upgrade';
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
      className={`plan-nudge plan-nudge--${variant}`}
    >
      <div className="plan-nudge__content">
        <span className="plan-nudge__icon" aria-hidden="true">
          <WarningIcon size={20} />
        </span>
        <p className="plan-nudge__message">{label}</p>
      </div>

      <div className="plan-nudge__actions">
        <button
          type="button"
          onClick={handleUpgrade}
          className={`plan-nudge__upgrade plan-nudge__upgrade--${variant}`}
          aria-label="Upgrade your plan"
        >
          Upgrade plan
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="plan-nudge__dismiss"
          aria-label="Dismiss this notification"
          title="Dismiss"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
