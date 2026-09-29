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
