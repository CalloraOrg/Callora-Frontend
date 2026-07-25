import { useState, useRef, useEffect } from "react";

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
        className={className}
        role="status"
        aria-live="polite"
        aria-label={`Successfully subscribed to ${apiName}`}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        {/* Checkmark icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="10" cy="10" r="9" fill="#10b981" />
          <path
            d="M6 10l3 3 5-5"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>
          Subscribed!
        </span>
      </div>
    );
  }

  if (status === "confirming") {
    return (
      <div
        className={className}
        role="dialog"
        aria-modal="false"
        aria-label={`Confirm subscription to ${apiName}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid var(--border-subtle, #374151)",
          background: "var(--bg-subtle, #111827)",
        }}
      >
        <p
          id="subscribe-confirm-desc"
          style={{ margin: 0, fontSize: 14, color: "var(--text-secondary, #9ca3af)" }}
        >
          Subscribe to <strong style={{ color: "var(--text-main, #f3f4f6)" }}>{apiName}</strong>?
          You will receive updates and can manage your subscription at any time.
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            ref={confirmRef}
            className="primary-button"
            aria-describedby="subscribe-confirm-desc"
            aria-busy={isLoading}
            disabled={isLoading}
            onClick={handleConfirm}
            style={{ flex: 1 }}
          >
            {isLoading ? "Subscribing…" : "Confirm"}
          </button>

          <button
            className="ghost-button"
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
      className={`secondary-button${className ? ` ${className}` : ""}`}
      aria-label={`Subscribe to ${apiName}`}
      onClick={handleSubscribeClick}
    >
      Subscribe
    </button>
  );
}
