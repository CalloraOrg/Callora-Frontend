import React from 'react';
import { WarningIcon } from './icons/WarningIcon';
import { CheckIcon } from './icons/CheckIcon';
import KbdHint from './KbdHint';

interface PlanNudgeProps {
  usagePercent: number;
  onDismiss: () => void;
}

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
      <div className="plan-nudge__illustration" aria-hidden="true">
        <picture>
          <source
            srcSet="/images/plan-upgrade-sm.svg"
            media="(max-width: 480px)"
          />
          <source
            srcSet="/images/plan-upgrade-md.svg"
            media="(max-width: 960px)"
          />
          <source
            srcSet="/images/plan-upgrade-lg.svg"
            media="(min-width: 961px)"
          />
          <img
            src="/images/plan-upgrade-md.svg"
            alt=""
            className="plan-nudge__img"
            loading="lazy"
            width="200"
            height="160"
          />
        </picture>
      </div>

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
          <KbdHint
            shortcut={{ key: 'u', description: 'Upgrade', category: 'Plan' }}
            variant="chip"
            label="Upgrade keyboard shortcut"
          />
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