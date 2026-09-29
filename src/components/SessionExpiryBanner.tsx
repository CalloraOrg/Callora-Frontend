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
    outline: 2px solid var(--accent, #4e85ff);
    outline-offset: 2px;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(78, 133, 255, 0.55));
  }
`;
