import React from 'react';
import { useTheme } from '../ThemeContext';

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
 */
export default function PlanNudge({ usagePercent, onDismiss }: PlanNudgeProps) {
  const { actualTheme } = useTheme();

  // Only render at the >=80% threshold
  if (usagePercent < 80) return null;

  const isCritical = usagePercent >= 95;

  const label = isCritical
    ? `Critical: you've used ${usagePercent}% of your plan quota. Upgrade now to avoid service interruptions.`
    : `Heads up: you've used ${usagePercent}% of your plan quota. Consider upgrading your plan.`;

  // Colour tokens that work in both light and dark themes while meeting
  // WCAG AA contrast requirements (≥4.5:1 for normal text).
  const styles: Record<string, React.CSSProperties> = {
    banner: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.5rem',
      padding: '0.75rem 1rem',
      marginBottom: '1.25rem',
      borderRadius: '0.5rem',
      border: `1.5px solid ${
        isCritical
          ? actualTheme === 'dark' ? '#f87171' : '#b91c1c'
          : actualTheme === 'dark' ? '#facc15' : '#b45309'
      }`,
      backgroundColor: isCritical
        ? actualTheme === 'dark' ? '#450a0a' : '#fee2e2'
        : actualTheme === 'dark' ? '#422006' : '#fef9c3',
      color: isCritical
        ? actualTheme === 'dark' ? '#fca5a5' : '#7f1d1d'
        : actualTheme === 'dark' ? '#fde68a' : '#78350f',
    },
    content: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      flex: '1 1 auto',
      minWidth: 0,
    },
    icon: {
      flexShrink: 0,
      fontSize: '1.125rem',
      lineHeight: 1,
      userSelect: 'none' as const,
    },
    message: {
      margin: 0,
      fontSize: '0.875rem',
      lineHeight: 1.5,
      fontWeight: 500,
    },
    actions: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flexShrink: 0,
    },
    upgradeLink: {
      fontSize: '0.875rem',
      fontWeight: 600,
      textDecoration: 'underline',
      color: 'inherit',
      whiteSpace: 'nowrap' as const,
      cursor: 'pointer',
    },
    dismissButton: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '0.25rem',
      lineHeight: 1,
      color: 'inherit',
      fontSize: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '0.25rem',
      flexShrink: 0,
    },
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
      style={styles.banner}
    >
      <div style={styles.content}>
        <span aria-hidden="true" style={styles.icon}>
          {isCritical ? '🚨' : '⚠️'}
        </span>
        <p style={styles.message}>{label}</p>
      </div>

      <div style={styles.actions}>
        <a
          href="/billing/upgrade"
          style={styles.upgradeLink}
          aria-label="Upgrade your plan"
        >
          Upgrade plan
        </a>
        <button
          type="button"
          onClick={onDismiss}
          style={styles.dismissButton}
          aria-label="Dismiss this notification"
          title="Dismiss"
        >
          {/* ✕ rendered as SVG for reliable cross-browser sizing */}
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
