import React from 'react';
import { WarningIcon } from './icons/WarningIcon';
import { CheckIcon } from './icons/CheckIcon';

interface PlanNudgeProps {
  /** Quota usage as a number from 0–100. Banner only renders at >=80. */
  usagePercent: number;
  /** Called when the user dismisses the banner. */
  onDismiss: () => void;
}

/**
 * PlanNudge – a theme-aware, WCAG 2.1 AA compliant upgrade nudge banner.
 *
 * Displays at >=80% quota usage and is hidden when dismissed (for 24h via
 * the useQuota hook in the parent). Shows a distinct message at >=95%.
 *
 * Part of GrantFox FWC26 campaign UI/UX requirements. Uses design tokens
 * instead of hardcoded hex colors so it respects the active theme.
 */
export default function PlanNudge({ usagePercent, onDismiss }: PlanNudgeProps) {
  if (usagePercent < 80) return null;

  const isCritical = usagePercent >= 95;

  const label = isCritical
    ? `Critical: you've used ${usagePercent}% of your plan quota. Upgrade now to avoid service interruptions.`
    : `Heads up: you've used ${usagePercent}% of your plan quota. Consider upgrading your plan.`;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
      className={`plan-nudge${isCritical ? ' plan-nudge--critical' : ''}`}
    >
      <div className="plan-nudge__content">
        <span className="plan-nudge__icon" aria-hidden="true">
          {isCritical ? (
            <WarningIcon size={20} className="plan-nudge__icon-critical" />
          ) : (
            <WarningIcon size={20} className="plan-nudge__icon-warning" />
          )}
        </span>
        <p className="plan-nudge__message">{label}</p>
      </div>

      <div className="plan-nudge__actions">
        <a
          href="/billing/upgrade"
          className="plan-nudge__upgrade-link"
          aria-label="Upgrade your plan"
        >
          <CheckIcon size={16} aria-hidden="true" />
          Upgrade plan
        </a>
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
