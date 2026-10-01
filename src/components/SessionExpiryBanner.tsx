import React from 'react';
import { WarningIcon } from './icons/WarningIcon';

export type SessionExpiryBannerProps = {
  /** Called when the user dismisses the banner. */
  onDismiss?: () => void;
  /** Overrides the default copy; used for non-auth session reasons. */
  message?: string;
};

/**
 * SessionExpiryBanner — app-wide notice that the session is no longer valid.
 *
 * Rendered in response to `signalExpiry('unauthorized')`, which the API layer
 * fires whenever a write comes back 401. It is an assertive alert because the
 * user's next action will fail silently otherwise: the form is still filled
 * in, but nothing they submit will be accepted.
 */
export default function SessionExpiryBanner({
  onDismiss,
  message = 'Your session has expired. Sign in again to submit this API for review — your draft has been kept.',
}: SessionExpiryBannerProps) {
  return (
    <>
      <style>{BANNER_STYLES}</style>
      <div className="se-banner" role="alert" aria-live="assertive">
        <span className="se-banner__icon" aria-hidden="true">
          <WarningIcon size={20} />
        </span>
        <p className="se-banner__text">{message}</p>
        {onDismiss && (
          <button type="button" className="se-banner__dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        )}
import { useEffect, useRef, useState } from 'react';

/**
 * SessionExpiryBanner — Non-intrusive banner shown when a session expires.
 *
 * Displays a warning with a countdown and optional redirect. Users can dismiss
 * the banner to keep working, or click a CTA to re-authenticate. Form data
 * is preserved in localStorage by the useFormPersistence hook.
 *
 * Design tokens used: --accent, --danger, --surface-strong, --text, --muted,
 * --line, consistent with the Callora design system.
 */
export interface SessionExpiryBannerProps {
  /** Whether to show the banner */
  isVisible: boolean;
  /** Seconds remaining before auto-redirect (null if no redirect) */
  countdown: number | null;
  /** Callback to dismiss the banner */
  onDismiss: () => void;
  /** Callback to navigate to login / re-authenticate */
  onReauthenticate?: () => void;
  /** Optional custom message */
  message?: string;
}

export default function SessionExpiryBanner({
  isVisible,
  countdown,
  onDismiss,
  onReauthenticate,
  message,
}: SessionExpiryBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Delay banner appearance for smoother UX
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setShowBanner(true), 100);
      return () => clearTimeout(timer);
    }
    setShowBanner(false);
  }, [isVisible]);

  // Move focus to banner for screen readers
  useEffect(() => {
    if (showBanner && bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [showBanner]);

  if (!showBanner) return null;

  return (
    <>
      <style>{STYLES}</style>
      <div
        ref={bannerRef}
        className="session-expiry-banner"
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
      >
        <div className="session-expiry-banner__icon" aria-hidden="true">
          ⏰
        </div>
        <div className="session-expiry-banner__content">
          <p className="session-expiry-banner__title">
            {message ?? 'Your session has expired'}
          </p>
          <p className="session-expiry-banner__detail">
            Your unsaved form data has been preserved. You can dismiss this
            notification and continue working, or re-authenticate to resume
            your session.
          </p>
          {countdown !== null && countdown > 0 && (
            <p className="session-expiry-banner__countdown">
              Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          )}
        </div>
        <div className="session-expiry-banner__actions">
          {onReauthenticate && (
            <button
              type="button"
              className="session-expiry-banner__btn session-expiry-banner__btn--primary"
              onClick={onReauthenticate}
            >
              Re-authenticate
            </button>
          )}
          <button
            type="button"
            className="session-expiry-banner__btn session-expiry-banner__btn--secondary"
            onClick={onDismiss}
            aria-label="Dismiss session expiry notification"
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  );
}

const BANNER_STYLES = `
  .se-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 12px;
    border: 1px solid var(--danger, #ff7d8d);
    background: rgba(220, 38, 38, 0.1);
    color: var(--text, #f3f5fb);
  }

  .se-banner__icon {
    display: inline-flex;
    align-items: center;
    color: var(--danger, #ff7d8d);
    flex-shrink: 0;
  }

  .se-banner__text {
    margin: 0;
    flex: 1;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .se-banner__dismiss {
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--line, rgba(169, 184, 255, 0.16));
    background: var(--surface-soft, rgba(255, 255, 255, 0.04));
    color: var(--text, #f3f5fb);
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }

  .se-banner__dismiss:hover {
    background: var(--line, rgba(169, 184, 255, 0.16));
  }

  .se-banner__dismiss:focus-visible {
const STYLES = `
  .session-expiry-banner {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    max-width: 560px;
    width: calc(100% - 32px);
    padding: 16px 20px;
    border-radius: 14px;
    background: var(--surface-strong, #0e1427);
    border: 1px solid var(--danger, #ff7d8d);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 125, 141, 0.15);
    animation: session-expiry-slide-in 300ms ease-out;
  }

  @keyframes session-expiry-slide-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-12px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .session-expiry-banner__icon {
    font-size: 1.4rem;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 2px;
  }

  .session-expiry-banner__content {
    flex: 1;
    min-width: 0;
  }

  .session-expiry-banner__title {
    margin: 0 0 4px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--danger, #ff7d8d);
  }

  .session-expiry-banner__detail {
    margin: 0 0 6px;
    font-size: 0.85rem;
    color: var(--muted, #93a0bf);
    line-height: 1.55;
  }

  .session-expiry-banner__countdown {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted, #93a0bf);
    font-variant-numeric: tabular-nums;
  }

  .session-expiry-banner__actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .session-expiry-banner__btn {
    min-height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    white-space: nowrap;
    transition: background 150ms ease, transform 150ms ease;
  }

  .session-expiry-banner__btn--primary {
    background: var(--danger, #ff7d8d);
    color: #ffffff;
  }

  .session-expiry-banner__btn--primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .session-expiry-banner__btn--secondary {
    background: var(--surface-soft, rgba(255, 255, 255, 0.06));
    color: var(--text, #f3f5fb);
    border-color: var(--line, rgba(169, 184, 255, 0.16));
  }

  .session-expiry-banner__btn--secondary:hover {
    background: var(--line, rgba(169, 184, 255, 0.16));
  }

  .session-expiry-banner__btn:focus-visible {
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78, 133, 255, 0.55));
  }

  @media (max-width: 480px) {
    .session-expiry-banner {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .session-expiry-banner__actions {
      flex-direction: row;
    }

    .session-expiry-banner__btn {
      flex: 1;
    }
  }
`;
