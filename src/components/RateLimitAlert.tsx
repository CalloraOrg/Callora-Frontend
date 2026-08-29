import { formatCountdown } from "../utils/format";

interface RateLimitAlertProps {
  /** Milliseconds until rate-limit resets. */
  timeUntilReset: number;
  /** Maximum requests in the rate-limit window. */
  limit?: number;
  /** Current remaining requests. */
  remaining?: number;
  /** Optional callback when user clicks "Try again" button. */
  onRetry?: () => void;
  /** Show compact version (single line). */
  compact?: boolean;
}

export default function RateLimitAlert({
  timeUntilReset,
  limit,
  remaining,
  onRetry,
  compact = false,
}: RateLimitAlertProps) {
  const isRateLimited = timeUntilReset > 0;
  const countdownText = formatCountdown(timeUntilReset);

  if (!isRateLimited) {
    return null;
  }

  if (compact) {
    return (
      <div
        className="rate-limit-alert rate-limit-alert-compact"
        role="alert"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          background: "rgba(255, 125, 141, 0.1)",
          border: "1px solid var(--danger)",
          borderRadius: "8px",
          fontSize: "0.875rem",
          color: "var(--danger)",
        }}
      >
        <span style={{ fontWeight: 500 }}>
          Rate limited. Retry in {countdownText}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ghost-button"
            type="button"
            style={{
              marginLeft: "auto",
              padding: "4px 8px",
              fontSize: "0.8125rem",
              whiteSpace: "nowrap",
            }}
          >
            Try now
          </button>
        )}
      </div>
    );
  }

  return (
    <section
      className="rate-limit-alert surface placeholder-card"
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        margin: "0 auto",
        maxWidth: "400px",
        padding: "48px 28px",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <div
        aria-hidden="true"
        style={{
          width: "80px",
          height: "80px",
          margin: "0 auto 24px",
          borderRadius: "50%",
          background: "rgba(255, 125, 141, 0.1)",
          border: "1px solid var(--danger)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--danger)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Hourglass icon */}
          <path d="M6 2h12" />
          <path d="M6 2v4a6 6 0 0 0 6 6c3.314 0 6-2.686 6-6V2" />
          <path d="M6 22h12" />
          <path d="M18 22v-4a6 6 0 0 0-6-6c-3.314 0-6 2.686-6 6v4" />
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
        Rate Limit Exceeded
      </h2>

      {/* Description */}
      <p className="helper-text" style={{ marginBottom: "20px" }}>
        You've made too many requests. Please wait before trying again.
      </p>

      {/* Countdown display */}
      <div
        style={{
          background: "var(--surface-soft)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--muted)",
            marginBottom: "8px",
          }}
        >
          Retry available in
        </div>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: "700",
            color: "var(--text)",
            fontFamily: "'Courier New', monospace",
          }}
        >
          {countdownText}
        </div>
      </div>

      {/* Stats (if available) */}
      {limit !== undefined && remaining !== undefined && (
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

      {/* Retry button */}
      {onRetry && (
        <button
          className="primary-button"
          onClick={onRetry}
          type="button"
          style={{
            minWidth: "140px",
            minHeight: "48px",
          }}
        >
          Try again
        </button>
      )}

      {/* Help text */}
      <div
        style={{
          marginTop: "24px",
          paddingTop: "24px",
          borderTop: "1px solid var(--line)",
          fontSize: "0.8125rem",
          color: "var(--muted)",
          lineHeight: "1.5",
        }}
      >
        <p style={{ margin: 0 }}>
          If this issue persists, contact{" "}
          <a
            href="mailto:support@callora.com"
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            support@callora.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
