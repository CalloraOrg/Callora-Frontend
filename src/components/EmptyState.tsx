import React from "react";

export interface EmptyStateProps {
  variant?: "empty" | "filtered" | "error";
  title?: string;
  message?: string;
  onClearFilters?: () => void;
  onRetry?: () => void | Promise<void>;
}

/**
 * EmptyState component with three distinct variants for different marketplace states.
 * - empty: Default state when no APIs exist
 * - filtered: State when filters are too narrow (shows "Clear all filters" CTA)
 * - error: Network/fetch error state (shows "Retry" button)
 *
 * All illustrations are decorative and aria-hidden.
 * Maintains consistent spacing and typography across variants to prevent layout shift.
 */
export default function EmptyState({
  variant = "empty",
  title,
  message,
  onClearFilters,
  onRetry,
}: EmptyStateProps) {
  // Default copy based on variant
  const defaults = {
    empty: {
      title: "No APIs available",
      message: "Check back soon for new integrations.",
    },
    filtered: {
      title: "No results found",
      message: "Your filters are too narrow. Try adjusting them.",
    },
    error: {
      title: "Failed to load APIs",
      message: "We encountered an error fetching the marketplace. Please try again.",
    },
  };

  const finalTitle = title ?? defaults[variant].title;
  const finalMessage = message ?? defaults[variant].message;
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 32px",
        minHeight: "300px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Illustration - 80px container matching ServerError pattern */}
      <div
        aria-hidden="true"
        style={{
          width: "80px",
          height: "80px",
          margin: "0 auto 24px",
          borderRadius: "50%",
          background: "var(--surface-soft)",
          border: "1px solid var(--line)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {variant === "empty" && (
          <svg
            width="40"
            height="40"
            viewBox="0 0 64 64"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
          >
            {/* Shopping bag icon */}
            <path d="M20 16h24v28c0 2.21-1.79 4-4 4H24c-2.21 0-4-1.79-4-4V16z" />
            <path d="M24 16V12c0-2.21 1.79-4 4-4h8c2.21 0 4 1.79 4 4v4M32 28v8M24 28h16" />
          </svg>
        )}
        {variant === "filtered" && (
          <svg
            width="40"
            height="40"
            viewBox="0 0 64 64"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
          >
            {/* Filter/funnel icon with strikethrough */}
            <path d="M12 16h40v6H12zM16 28h32v6H16zM20 40h24v6H20z" />
            <line x1="16" y1="16" x2="48" y2="48" strokeLinecap="round" />
          </svg>
        )}
        {variant === "error" && (
          <svg
            width="40"
            height="40"
            viewBox="0 0 64 64"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
          >
            {/* Warning triangle */}
            <path d="M32 8L54 48H10L32 8z" strokeLinejoin="round" />
            <line x1="32" y1="28" x2="32" y2="36" strokeLinecap="round" />
            <circle cx="32" cy="44" r="1" fill="var(--muted)" />
          </svg>
        )}
      </div>

      {/* Heading */}
      <h2
        style={{
          margin: "0 0 12px 0",
          fontSize: "clamp(1.375rem, 2vw, 1.625rem)",
          fontWeight: "600",
          color: "var(--text)",
          lineHeight: 1.2,
        }}
      >
        {finalTitle}
      </h2>

      {/* Body copy */}
      <p
        style={{
          margin: "0 0 24px 0",
          color: "var(--muted)",
          fontSize: "0.9375rem",
          lineHeight: 1.5,
          maxWidth: "320px",
        }}
      >
        {finalMessage}
      </p>

      {/* Primary action */}
      {variant === "filtered" && onClearFilters && (
        <button
          className="primary-button"
          onClick={onClearFilters}
          style={{
            minHeight: "44px",
            minWidth: "160px",
          }}
          type="button"
        >
          Clear all filters
        </button>
      )}

      {variant === "error" && onRetry && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            className="primary-button"
            onClick={handleRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
            type="button"
            style={{
              minHeight: "44px",
              minWidth: "160px",
            }}
          >
            {isRetrying ? "Retrying…" : "Retry"}
          </button>
          <a
            href="https://status.callora.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.875rem",
              color: "var(--accent)",
              textDecoration: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLAnchorElement).style.textDecoration = "underline";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLAnchorElement).style.textDecoration = "none";
            }}
          >
            Check system status
          </a>
        </div>
      )}
    </div>
  );
}
