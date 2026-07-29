import { useCallback, useEffect, useState } from "react";
import SubscribeButton from "../components/SubscribeButton";
import Tooltip from "../components/Tooltip";
import { LinkIcon } from "../components/icons/LinkIcon";
import { formatPrice } from "../utils/format";

/**
 * SubscribeCTA — a sticky bottom bar that appears when the hero CTA scrolls
 * out of view.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Icon-only buttons (copy link) are wrapped in the shared {@link Tooltip}
 *   primitive so every user gets a visible label.
 * - Tooltips open on hover (300 ms delay), on keyboard focus, and on touch
 *   long-press (500 ms) — consistent with Breadcrumb #726 and ApiTagFilter #533.
 * - `aria-describedby` connects the trigger to the tooltip content.
 * - Escape dismisses an open tooltip.
 * - Colours come from design tokens so they work in both light and dark mode.
 *
 * Part of GrantFox FWC26 campaign (issue #746).
 */
type Props = {
  /** Name of the API. */
  apiName: string;
  /** Cost per request. */
  pricePerRequest: number;
  /** Subscribe button callback. */
  onSubscribe?: () => void;
  /** The CSS selector of the hero element to observe for scrolling out of view. */
  observeElementSelector?: string;
};

export default function SubscribeCTA({
  apiName,
  pricePerRequest,
  onSubscribe,
  observeElementSelector = ".api-hero__cta",
}: Props): JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  }, []);

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
        // Bar is visible when the main hero CTA is NOT in view (intersecting ratio is 0)
        setIsVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [observeElementSelector]);

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

          <div className="subscribe-cta-bar__icon-group">
            <Tooltip
              content={linkCopied ? "Link copied!" : "Copy link"}
              hoverDelayMs={300}
              longPressMs={500}
            >
              <button
                type="button"
                className="subscribe-cta-bar__icon-button"
                aria-label={linkCopied ? "Link copied!" : "Copy link to this API"}
                onClick={handleCopyLink}
              >
                <LinkIcon size={16} aria-hidden="true" />
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
