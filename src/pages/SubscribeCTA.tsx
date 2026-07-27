import { useEffect, useState } from "react";
import SubscribeButton from "../components/SubscribeButton";
import { formatPrice } from "../utils/format";

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
