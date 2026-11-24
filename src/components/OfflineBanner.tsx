import { WarningIcon } from './icons/WarningIcon';

export type OfflineBannerProps = {
  /** Whether the browser currently reports a network connection. */
  isOnline: boolean;
};

/**
 * OfflineBanner — app-wide notice that the browser is offline and that cached
 * data may be stale.
 *
 * It is rendered by `App` next to the other global banners. There is no
 * dismiss action: the notice must stay visible until connectivity returns.
 */
export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline) return null;

  return (
    <>
      <style>{BANNER_STYLES}</style>
      <div className="offline-banner" role="status" aria-live="polite">
        <span className="offline-banner__icon" aria-hidden="true">
          <WarningIcon size={20} />
        </span>
        <p className="offline-banner__text">
          You are offline. Saved data from the offline cache may be out of date.
        </p>
      </div>
    </>
  );
}

const BANNER_STYLES = `
  .offline-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    margin-bottom: 16px;
    border-radius: 12px;
    border: 1px solid var(--warning, #f0b429);
    background: var(--warning-soft, rgba(240, 180, 41, 0.12));
    color: var(--text, #f3f5fb);
  }

  .offline-banner__icon {
    display: inline-flex;
    align-items: center;
    color: var(--warning, #f0b429);
    flex-shrink: 0;
  }

  .offline-banner__text {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
  }
`;
