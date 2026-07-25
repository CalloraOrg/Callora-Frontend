import { useState, useRef, useEffect } from "react";
import { CheckIcon } from "./icons/CheckIcon";

type SubscribeStatus = "idle" | "confirming" | "subscribed";

type Props = {
  /** Name of the API being subscribed to – shown in the confirmation dialog. */
  apiName: string;
  /** Called when the user confirms the subscription. */
  onSubscribe?: () => void | Promise<void>;
  /** Optional CSS class forwarded to the outer element. */
  className?: string;
};

/**
 * SubscribeButton
 *
 * A WCAG 2.1 AA accessible subscribe flow:
 *   1. User clicks "Subscribe" → an inline confirmation prompt appears.
 *   2. User clicks "Confirm" → subscription is registered and a success state
 *      is shown.
 *   3. "Cancel" returns to the idle state without any side-effects.
 *
 * Focus management: When the confirmation dialog opens, focus is moved to the
 * "Confirm" button so keyboard-only users can immediately confirm or cancel
 * with a single keystroke.
 *
 * Part of GrantFox FWC26 campaign UI/UX requirements.
 * Uses CSS design tokens (not inline hex colors) per UI Design System.
 */
export default function SubscribeButton({ apiName, onSubscribe, className }: Props) {
  const [status, setStatus] = useState<SubscribeStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Move focus into the confirmation dialog when it opens.
  useEffect(() => {
    if (status === "confirming") {
      confirmRef.current?.focus();
    }
  }, [status]);

  const handleSubscribeClick = () => {
    setStatus("confirming");
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onSubscribe?.();
      setStatus("subscribed");
    } catch {
      // Surface the error without crashing; keep the confirmation open.
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setStatus("idle");
  };

  if (status === "subscribed") {
    return (
      <div
        className={`subscribe-button subscribe-button--subscribed ${className ?? ""}`.trim()}
        role="status"
        aria-live="polite"
        aria-label={`Successfully subscribed to ${apiName}`}
      >
        <span className="subscribe-button__check-icon" aria-hidden="true">
          <CheckIcon size={18} />
        </span>
        <span className="subscribe-button__subscribed-label">
          Subscribed!
        </span>
      </div>
    );
  }

  if (status === "confirming") {
    return (
      <div
        className={`subscribe-button subscribe-button--confirming ${className ?? ""}`.trim()}
        role="dialog"
        aria-modal="false"
        aria-label={`Confirm subscription to ${apiName}`}
      >
        <p
          id="subscribe-confirm-desc"
          className="subscribe-button__confirm-message"
        >
          Subscribe to <strong className="subscribe-button__confirm-api">{apiName}</strong>?
          You will receive updates and can manage your subscription at any time.
        </p>

        <div className="subscribe-button__confirm-actions">
          <button
            ref={confirmRef}
            className="primary-button subscribe-button__confirm-btn"
            aria-describedby="subscribe-confirm-desc"
            aria-busy={isLoading}
            disabled={isLoading}
            onClick={handleConfirm}
          >
            {isLoading ? "Subscribing…" : "Confirm"}
          </button>

          <button
            className="ghost-button subscribe-button__cancel-btn"
            onClick={handleCancel}
            disabled={isLoading}
            aria-label="Cancel subscription"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // idle state
  return (
    <button
      className={`secondary-button subscribe-button subscribe-button--idle ${className ?? ""}`.trim()}
      aria-label={`Subscribe to ${apiName}`}
      onClick={handleSubscribeClick}
    >
      Subscribe
    </button>
  );
}
