import { useEffect, useState } from "react";
import SubscribeButton from "../components/SubscribeButton";
import Tooltip from "../components/Tooltip";
import { formatPrice } from "../utils/format";

type Props = {
  /** Name of the API. */
  apiName: string;
  /** Cost per request. */
  pricePerRequest: number;
  /** Subscribe button callback. */
  onSubscribe?: () => void;
  /**
   * Called when the user clicks the Share icon button.
   * If not provided the button copies the current URL to the clipboard.
   */
  onShare?: () => void;
  /**
   * Called when the user clicks the Bookmark icon button.
   * Receives the current bookmarked state so the parent can toggle it.
   */
  onBookmark?: (isBookmarked: boolean) => void;
  /** Whether the API is currently bookmarked / pinned. Defaults to false. */
  isBookmarked?: boolean;
  /** The CSS selector of the hero element to observe for scrolling out of view. */
  observeElementSelector?: string;
  /**
   * Milliseconds to wait after mouseenter before a tooltip opens.
   * Applies to both icon-only action buttons.
   * @default 300
   */
  tooltipHoverDelayMs?: number;
  /**
   * Milliseconds of touch contact required to trigger the tooltip on mobile.
   * Applies to both icon-only action buttons.
   * @default 500
   */
  tooltipLongPressMs?: number;
};

/**
 * ShareIcon — lightweight inline SVG for the share action.
 * Kept local because it is only used in this component.
 * `aria-hidden` is always true; the accessible name comes from the
 * wrapping button's `aria-label`.
 */
function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Share-2 (Lucide) path */}
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

/**
 * BookmarkIcon — lightweight inline SVG for the bookmark action.
 * When `filled` is true the bookmark is solid, indicating a saved state.
 */
function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function SubscribeCTA({
  apiName,
  pricePerRequest,
  onSubscribe,
  onShare,
  onBookmark,
  isBookmarked = false,
  observeElementSelector = ".api-hero__cta",
  tooltipHoverDelayMs = 300,
  tooltipLongPressMs = 500,
}: Props): JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(isBookmarked);

  useEffect(() => {
    const target = document.querySelector(observeElementSelector);
    if (!target) {
      // Fallback: If target not found, toggle on scroll offset
      const handleScroll = () => {
        setIsVisible(window.scrollY > 250);
      };
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Bar is visible when the main hero CTA is NOT in view
        setIsVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [observeElementSelector]);

  /** Default share handler: copies the current page URL to the clipboard. */
  const handleShare = () => {
    if (onShare) {
      onShare();
    } else {
      navigator.clipboard
        ?.writeText(window.location.href)
        .catch(() => undefined);
    }
  };

  /** Toggle bookmark state and notify the parent. */
  const handleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    onBookmark?.(next);
  };

  return (
    <div
      className={`subscribe-cta-bar no-print ${
        isVisible ? "subscribe-cta-bar--visible" : ""
      }`}
      role="region"
      aria-label={`${apiName} Subscription Sticky Bar`}
    >
      <div className="subscribe-cta-bar__container">
        <div className="subscribe-cta-bar__info">
          <span className="subscribe-cta-bar__title-label">Currently Viewing</span>
          <strong className="subscribe-cta-bar__title">{apiName}</strong>
        </div>

        <div className="subscribe-cta-bar__actions">
          <div className="subscribe-cta-bar__price-group">
            <span className="subscribe-cta-bar__price-label">Price per call</span>
            <div className="subscribe-cta-bar__price">
              ${formatPrice(pricePerRequest)}
            </div>
          </div>

          {/* ── Icon-only action buttons ─────────────────────────────────────
              Each button is wrapped in the shared Tooltip primitive so it
              shows a label on hover (after hoverDelayMs), on keyboard focus,
              and on touch long-press (after longPressMs).

              WCAG 2.1 AA:
              - Every button has an explicit aria-label.
              - aria-pressed communicates toggle state for the bookmark.
              - Tooltip primitive adds aria-describedby on the trigger.
              ──────────────────────────────────────────────────────────────── */}
          <div
            className="subscribe-cta-bar__icon-actions"
            role="group"
            aria-label="API actions"
          >
            {/* Share button */}
            <Tooltip
              content={`Share ${apiName}`}
              hoverDelayMs={tooltipHoverDelayMs}
              longPressMs={tooltipLongPressMs}
            >
              <button
                type="button"
                className="subscribe-cta-bar__icon-btn"
                aria-label={`Share ${apiName}`}
                onClick={handleShare}
              >
                <ShareIcon />
              </button>
            </Tooltip>

            {/* Bookmark / save button */}
            <Tooltip
              content={bookmarked ? `Remove ${apiName} from saved` : `Save ${apiName}`}
              hoverDelayMs={tooltipHoverDelayMs}
              longPressMs={tooltipLongPressMs}
            >
              <button
                type="button"
                className={`subscribe-cta-bar__icon-btn${
                  bookmarked ? " subscribe-cta-bar__icon-btn--active" : ""
                }`}
                aria-label={
                  bookmarked
                    ? `Remove ${apiName} from saved`
                    : `Save ${apiName}`
                }
                aria-pressed={bookmarked}
                onClick={handleBookmark}
              >
                <BookmarkIcon filled={bookmarked} />
              </button>
            </Tooltip>
          </div>

          <SubscribeButton
            apiName={apiName}
            onSubscribe={onSubscribe}
            className="subscribe-cta-bar__button"
          />
        </div>
      </div>
    </div>
  );
}
