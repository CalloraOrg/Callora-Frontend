import { useState, useEffect, useRef } from "react";

interface ServerErrorProps {
  /** Optional retry callback. When provided, renders the retry button. */
  onRetry?: () => void | Promise<void>;
  /** Optional request ID for support traceability. Displayed as a masked reference only. */
  requestId?: string;
  /** Optional override for the error heading. Defaults to the standard copy. */
  title?: string;
  /** Optional override for the body copy. Defaults to the standard copy. */
  description?: string;
  /** Optional callback to go home. */
  onGoHome?: () => void;
  /** Optional ISO 8601 timestamp when rate-limit resets. Indicates a rate-limit error. */
  resetAt?: string;
  /** Current rate-limit remaining (used with resetAt for context). */
  remaining?: number;
  /** Rate-limit maximum (used with resetAt for context). */
  limit?: number;
}

export default function ServerError({
  onRetry,
  requestId,
  title,
  description,
  onGoHome,
  resetAt,
  remaining,
  limit,
}: ServerErrorProps) {
  const isRateLimited = !!resetAt;

  // Default titles and descriptions based on error type
  const finalTitle =
    title ||
    (isRateLimited ? "Rate Limit Exceeded" : "Something went wrong on our end");

  const finalDescription =
    description ||
    (isRateLimited
      ? "You've made too many requests. Please wait before trying again."
      : "This is not your fault. Our team has been notified and we're working on a fix. Please try again in a moment.");

  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  // Focus retry button on mount if onRetry is provided
  useEffect(() => {
    if (onRetry && retryButtonRef.current) {
      retryButtonRef.current.focus();
    }
  }, [onRetry]);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopyRequestId = async () => {
    if (!requestId) return;

    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Silently fail if clipboard API is not available
      console.error("Failed to copy request ID:", err);
    }
  };

  return (
    <section
      className="surface placeholder-card server-error"
      role="alert"
      style={{
        margin: "0 auto",
        maxWidth: "400px",
        padding: "48px 28px",
        textAlign: "center",
      }}
    >
      {/* Illustration */}
      <div
        aria-hidden="true"
        style={{
          width: "80px",
          height: "80px",
          margin: "0 auto 24px",
          borderRadius: "50%",
          background: isRateLimited
            ? "rgba(255, 125, 141, 0.1)"
            : "var(--surface-soft)",
          border: `1px solid ${isRateLimited ? "var(--danger)" : "var(--line)"}`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isRateLimited ? "var(--danger)" : "var(--muted)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isRateLimited ? (
            <>
              <path d="M6 2h12" />
              <path d="M6 2v4a6 6 0 0 0 6 6c3.314 0 6-2.686 6-6V2" />
              <path d="M6 22h12" />
              <path d="M18 22v-4a6 6 0 0 0-6-6c-3.314 0-6 2.686-6 6v4" />
            </>
          ) : (
            <>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </>
          )}
        </svg>
      </div>

      {/* Heading */}
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: "clamp(1.5rem, 2vw, 1.8rem)",
          fontWeight: "600",
          color: "var(--text)",
        }}
      >
        {finalTitle}
      </h2>

      {/* Body copy */}
      <p className="helper-text" style={{ marginBottom: "24px" }}>
        {finalDescription}
      </p>

      {/* Rate-limit stats (if present) */}
      {isRateLimited && limit !== undefined && remaining !== undefined && (
        <div
          style={{
            background: "var(--surface-soft)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "24px",
            fontSize: "0.8125rem",
            color: "var(--muted)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Limit
              </div>
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "var(--text)",
                }}
              >
                {limit.toLocaleString()}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                Remaining
              </div>
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "var(--danger)",
                }}
              >
                {remaining.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset time display (if present) */}
      {isRateLimited && resetAt && (
        <div
          style={{
            background: "var(--surface-soft)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted)",
              marginBottom: "8px",
            }}
          >
            Rate limit resets at
          </div>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: "600",
              color: "var(--text)",
              fontFamily: "'Courier New', monospace",
            }}
          >
            {new Date(resetAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>
      )}

      {/* Retry button */}
      {onRetry && (
        <button
          ref={retryButtonRef}
          className="primary-button"
          onClick={handleRetry}
          disabled={isRetrying}
          aria-busy={isRetrying}
          type="button"
          style={{
            minWidth: "140px",
            minHeight: "48px",
          }}
        >
          {isRetrying ? "Retrying…" : "Try again"}
        </button>
      )}

      {/* Request ID */}
      {requestId && (
        <div
          style={{
            marginTop: "32px",
            paddingTop: "24px",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--muted)",
                fontFamily: "'Courier New', monospace",
              }}
            >
              Reference: {requestId}
            </span>
            <button
              onClick={handleCopyRequestId}
              className="ghost-button"
              type="button"
              aria-label="Copy request ID"
              style={{
                minHeight: "32px",
                padding: "0 12px",
                fontSize: "0.8125rem",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: "absolute",
              left: "-10000px",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
          >
            {copied ? "Request ID copied to clipboard" : ""}
          </div>
        </div>
      )}
    </section>
  );
}
