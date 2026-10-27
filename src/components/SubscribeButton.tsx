import { useState, useRef, useEffect } from "react";
import { CheckIcon } from "./icons/CheckIcon";
import HelpPopover from "./HelpPopover";

type SubscribeStatus = "idle" | "confirming" | "confirming_unsubscribe" | "subscribed";

type Props = {
  /** Name of the API being subscribed to – shown in the confirmation dialog. */
  apiName: string;
  /** Whether the user is currently subscribed to this API. */
  isSubscribed?: boolean;
  /** Error message to display, if any. */
  error?: string | null;
  /** Optional badge/tag label (e.g. "Demo"). */
  badgeLabel?: string;
  /** Called when the user confirms the subscription. */
  onSubscribe?: () => void | Promise<void>;
  /** Called when the user confirms unsubscribing. */
  onUnsubscribe?: () => void | Promise<void>;
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
 *   4. Subscribed state shows "Subscribed" with an "Unsubscribe" button that
 *      prompts for confirmation before calling onUnsubscribe.
 *   5. On error, displays role="alert" message and keeps confirmation dialog open.
 *
 * Focus management: When the confirmation dialog opens, focus is moved to the
 * "Confirm" button so keyboard-only users can immediately confirm or cancel
 * with a single keystroke.
 */
export default function SubscribeButton({
  apiName,
  isSubscribed = false,
  error: externalError = null,
  badgeLabel,
  onSubscribe,
  onUnsubscribe,
  className,
}: Props) {
  const [internalStatus, setInternalStatus] = useState<SubscribeStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const confirmRef = useRef<HTMLButtonElement>(null);
  const unsubscribeConfirmRef = useRef<HTMLButtonElement>(null);

  const activeError = externalError || localError;

  useEffect(() => {
    if (internalStatus === "confirming") {
      confirmRef.current?.focus();
    } else if (internalStatus === "confirming_unsubscribe") {
      unsubscribeConfirmRef.current?.focus();
    }
  }, [internalStatus]);

  const handleSubscribeClick = () => {
    setLocalError(null);
    setInternalStatus("confirming");
  };

  const handleUnsubscribeClick = () => {
    setLocalError(null);
    setInternalStatus("confirming_unsubscribe");
  };

  const handleConfirmSubscribe = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setLocalError(null);
    try {
      await onSubscribe?.();
      setInternalStatus("subscribed");
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Subscription failed. Please try again.";
      setLocalError(msg);
      // Keep confirmation open
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleConfirmUnsubscribe = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setLocalError(null);
    try {
      await onUnsubscribe?.();
      setInternalStatus("idle");
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Unsubscribe failed. Please try again.";
      setLocalError(msg);
      // Keep confirmation open
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleCancel = () => {
    setLocalError(null);
    setInternalStatus("idle");
  };

  if (internalStatus === "confirming") {
    return (
      <div
        className={className ? `subscribe-confirming ${className}` : "subscribe-confirming"}
        role="dialog"
        aria-modal="false"
        aria-label={`Confirm subscription to ${apiName}`}
      >
        <p id="subscribe-confirm-desc" className="subscribe-confirming__message">
          Subscribe to <strong className="subscribe-confirming__name">{apiName}</strong>?
          You will receive updates and can manage your subscription at any time.
        </p>

        {activeError && (
          <div
            role="alert"
            className="subscribe-error-alert"
            style={{
              color: "var(--danger, #ef4444)",
              fontSize: "0.85rem",
              marginBottom: "var(--mkt-space-sm, 6px)",
            }}
          >
            {activeError}
          </div>
        )}

        <div className="subscribe-confirming__actions">
          <button
            ref={confirmRef}
            className="primary-button subscribe-button-confirm"
            aria-describedby="subscribe-confirm-desc"
            aria-busy={isLoading}
            disabled={isLoading}
            onClick={handleConfirmSubscribe}
          >
            {isLoading ? "Subscribing…" : "Confirm"}
          </button>

          <button
            className="ghost-button subscribe-button-cancel"
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

  if (internalStatus === "confirming_unsubscribe") {
    return (
      <div
        className={className ? `subscribe-confirming subscribe-confirming--unsubscribe ${className}` : "subscribe-confirming subscribe-confirming--unsubscribe"}
        role="dialog"
        aria-modal="false"
        aria-label={`Confirm unsubscribing from ${apiName}`}
      >
        <p id="unsubscribe-confirm-desc" className="subscribe-confirming__message">
          Unsubscribe from <strong className="subscribe-confirming__name">{apiName}</strong>?
          You can resubscribe at any time.
        </p>

        {activeError && (
          <div
            role="alert"
            className="subscribe-error-alert"
            style={{
              color: "var(--danger, #ef4444)",
              fontSize: "0.85rem",
              marginBottom: "var(--mkt-space-sm, 6px)",
            }}
          >
            {activeError}
          </div>
        )}

        <div className="subscribe-confirming__actions">
          <button
            ref={unsubscribeConfirmRef}
            className="primary-button subscribe-button-confirm"
            aria-describedby="unsubscribe-confirm-desc"
            aria-busy={isLoading}
            disabled={isLoading}
            onClick={handleConfirmUnsubscribe}
          >
            {isLoading ? "Unsubscribing…" : "Confirm"}
          </button>

          <button
            className="ghost-button subscribe-button-cancel"
            onClick={handleCancel}
            disabled={isLoading}
            aria-label="Cancel unsubscribe"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const effectiveSubscribed = isSubscribed || internalStatus === "subscribed";

  if (effectiveSubscribed) {
    return (
      <div
        className={className ? `subscribe-subscribed-wrap ${className}` : "subscribe-subscribed-wrap"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--mkt-space-sm, 8px)",
        }}
      >
        <div
          className="subscribe-subscribed"
          role="status"
          aria-live="polite"
          aria-label={`Successfully subscribed to ${apiName}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--mkt-space-xs, 4px)",
          }}
        >
          <CheckIcon size={20} aria-hidden="true" />
          <span className="subscribe-subscribed__text">
            Subscribed!
          </span>
        </div>

        {badgeLabel && (
          <span
            className="subscribe-badge-demo"
            style={{
              fontSize: "0.75rem",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.1)",
              color: "var(--muted, #94a3b8)",
              border: "1px solid var(--line, rgba(255, 255, 255, 0.1))",
            }}
          >
            {badgeLabel}
          </span>
        )}

        <button
          type="button"
          className="ghost-button subscribe-button-unsubscribe"
          aria-label={`Unsubscribe from ${apiName}`}
          onClick={handleUnsubscribeClick}
          style={{ fontSize: "0.85rem", padding: "4px 8px" }}
        >
          Unsubscribe
        </button>
      </div>
    );
  }

  // idle state
  return (
    <span
      className={`subscribe-idle${className ? ` ${className}` : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--mkt-space-sm, 4px)",
      }}
    >
      <button
        type="button"
        className="secondary-button subscribe-button"
        aria-label={`Subscribe to ${apiName}`}
        onClick={handleSubscribeClick}
      >
        Subscribe
      </button>

      {badgeLabel && (
        <span
          className="subscribe-badge-demo"
          style={{
            fontSize: "0.75rem",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "rgba(255, 255, 255, 0.1)",
            color: "var(--muted, #94a3b8)",
            border: "1px solid var(--line, rgba(255, 255, 255, 0.1))",
          }}
        >
          {badgeLabel}
        </span>
      )}

      <HelpPopover
        content={
          <span>
            <strong style={{ display: "block", marginBottom: "0.25rem" }}>
              What is "Subscribing"?
            </strong>
            <span style={{ display: "block" }}>
              Subscribing gives you access to this API’s endpoints. You are
              charged per successful API request — you only pay for what you
              use.
            </span>
            <span
              style={{
                display: "block",
                marginTop: "0.25rem",
                opacity: 0.85,
              }}
            >
              Your subscription can be managed or cancelled at any time.
            </span>
          </span>
        }
        ariaLabel={`Help: What does subscribing to ${apiName} mean?`}
      />
    </span>
  );
}
