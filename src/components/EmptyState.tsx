import React from "react";
import ExternalLink from "./ExternalLink";
import { EmptyStateSkeleton } from "./Skeleton";

export type EmptyStateVariant = "empty" | "api-detail" | "filtered" | "error";
export type EmptyStateSize = "default" | "compact";

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  size?: EmptyStateSize;
  title?: string;
  message?: string;
  onClearFilters?: () => void;
  onRetry?: () => void | Promise<void>;
  action?: {
    label: string;
    onClick: () => void;
  };
  loading?: boolean;
}

/**
 * Renders the SVG illustration for the given variant.
 * All illustrations are decorative (aria-hidden in parent).
 *
 * Visual language (v7):
 *  - Line-art style using `var(--muted)` primary stroke
 *  - Subtle `var(--accent)` accent stroke for focal highlights
 *    (kept below "primary visual cue" weight so text remains the
 *    unambiguous source of meaning — satisfies WCAG 1.4.1 Use of Color)
 *  - strokeLinecap="round" / strokeLinejoin="round" for a softer,
 *    more modern appearance consistent with the UI design system
 *
 * @param variant - The empty state variant
 * @param size - Controls stroke width and SVG bounding box:
 *               compact modes use slightly thinner strokes and a
 *               smaller viewport so illustrations retain visual balance
 *               inside narrow panels like FiltersSidebar.
 */
function EmptyIllustration({
  variant,
  size = "default",
}: {
  variant: EmptyStateVariant;
  size?: EmptyStateSize;
}) {
  const strokeWidth = size === "compact" ? 1.75 : 2;
  const accentStroke = size === "compact" ? 1.5 : 1.75;
  const box = size === "compact" ? 28 : 40;

  if (variant === "empty") {
    return (
      <svg
        width={box}
        height={box}
        viewBox="0 0 64 64"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M16 22l16-8 16 8v20c0 2.21-1.79 4-4 4H20c-2.21 0-4-1.79-4-4V22z"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <path
          d="M16 22l16 8 16-8M32 30v16"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle cx="46" cy="14" r="1.5" fill="var(--accent)" stroke="none" />
        <circle cx="18" cy="48" r="1.25" fill="var(--accent)" stroke="none" />
        <path
          d="M50 40l2 2M54 44l1.5 1.5"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
        />
      </svg>
    );
  }

  if (variant === "api-detail") {
    return (
      <svg
        width={box}
        height={box}
        viewBox="0 0 64 64"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect
          x="13"
          y="16"
          width="38"
          height="32"
          rx="6"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <path
          d="M20 25h14M20 32h10M20 39h7"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.85}
        />
        <path
          d="M40 28v-4M46 28v-4M38 28h10v8a5 5 0 0 1-10 0v-8zM43 41v7"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
        />
        <circle cx="52" cy="13" r="1.5" fill="var(--accent)" stroke="none" />
        <path
          d="M10 51h18"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.7}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  if (variant === "filtered") {
    return (
      <svg
        width={box}
        height={box}
        viewBox="0 0 64 64"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M12 14h40l-14 16v18l-12-6V30L12 14z"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <path
          d="M20 14h24M24 22h16M27 29h10"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.85}
          strokeDasharray={size === "compact" ? "2 2" : "3 3"}
        />
        <circle
          cx="47"
          cy="47"
          r={size === "compact" ? 9 : 10}
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <line
          x1="54"
          y1="54"
          x2="60"
          y2="60"
          stroke="var(--accent)"
          strokeWidth={accentStroke + 0.25}
        />
        <path
          d="M23 18h4v4h-4z M31 18h4v4h-4z M39 18h4v4h-4z"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
          fill="none"
        />
        <line
          x1="10"
          y1="10"
          x2="58"
          y2="58"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.7}
          strokeDasharray={size === "compact" ? "1.5 3" : "2 4"}
          opacity="0.55"
        />
      </svg>
    );
  }

  return (
    <svg
      width={box}
      height={box}
      viewBox="0 0 64 64"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M32 8L54 48H10L32 8z"
        stroke="var(--muted)"
        strokeWidth={strokeWidth}
      />
      <path
        d="M32 28v8M32 43v1"
        stroke="var(--muted)"
        strokeWidth={strokeWidth}
      />
      <circle cx="32" cy="44" r="1" fill="var(--muted)" stroke="none" />
      <path
        d="M32 20l-3-4h6l-3 4z"
        stroke="var(--accent)"
        strokeWidth={accentStroke}
        fill="none"
      />
      <path
        d="M18 54h28"
        stroke="var(--muted)"
        strokeWidth={strokeWidth * 0.8}
        strokeDasharray={size === "compact" ? "2 2" : "3 3"}
      />
    </svg>
  );
}

/**
 * EmptyState component with three distinct variants for different marketplace states.
 *
 * Variants:
 * - empty:    Default state when no APIs exist in the marketplace.
 * - api-detail: A requested API listing is unavailable. Uses an API-card illustration.
 * - filtered: Active filters yield zero results. Shows a "Clear all filters" CTA.
 *             Used inline inside FiltersSidebar (compact) and the results grid (default).
 * - error:    Network/fetch failure. Shows a "Retry" button plus a status link.
 *
 * Sizes:
 * - default:  Full-size layout for result areas (48px padding, 80px illustration).
 * - compact:  Condensed layout for sidebars / inline use (16px padding, 56px illustration).
 *             Designed specifically for FiltersSidebar v7 with a tighter vertical rhythm
 *             and a tabular, sidebar-friendly message.
 *
 * Visual language (v7):
 * - Custom line-art SVG illustrations per variant, using `var(--muted)` for the primary
 *   stroke and `var(--accent)` as a *subordinate* accent.  Per WCAG 1.4.1 (Use of Color),
 *   meaning is always carried by the title + message text first; the accent marks are
 *   purely decorative.
 * - The illustration wrapper itself is aria-hidden so screen readers rely exclusively
 *   on the semantic heading + paragraph.
 * - Spacing, type scale, and illustration wrapper dimensions are locked per size so
 *   variant switches never cause layout shift.
 *
 * Design-token + dark-mode consistency:
 * - Every color references a token; no hardcoded hex values.
 * - The illustration circle uses `--surface` (compact) / `--surface-soft` (default) so
 *   it blends into its host container in both light and dark themes.
 */
export default function EmptyState({
  variant = "empty",
  size = "default",
  title,
  message,
  onClearFilters,
  onRetry,
  action,
  loading = false,
}: EmptyStateProps) {
  if (loading) {
    return (
      <EmptyStateSkeleton
        size={size}
        hasAction={!!action || (variant === "filtered" && !!onClearFilters) || (variant === "error" && !!onRetry)}
      />
    );
  }
  const defaults = {
    empty: {
      title: "No APIs available",
      message: "Check back soon for new integrations.",
    },
    "api-detail": {
      title: "API not found",
      message: "This API may have moved or is no longer available.",
    },
    filtered: {
      title: "No results found",
      message:
        size === "compact"
          ? "Adjust filters or clear to see results."
          : "Your filters are too narrow. Try adjusting them.",
    },
    error: {
      title: "Failed to load APIs",
      message:
        size === "compact"
          ? "Error loading results. Please retry."
          : "We encountered an error fetching the marketplace. Please try again.",
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

  const isCompact = size === "compact";

  const wrapperStyle: React.CSSProperties = isCompact
    ? {
        textAlign: "center",
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "var(--surface-soft)",
        border: "1px solid var(--line)",
        borderRadius: "10px",
      }
    : {
        textAlign: "center",
        padding: "48px 32px",
        minHeight: "300px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      };

  const illustrationSize = isCompact ? "56px" : "80px";
  const illustrationMargin = isCompact ? "0" : "0 auto 24px";

  const HeadingTag = isCompact ? ("h3" as const) : ("h2" as const);
  const headingStyle: React.CSSProperties = isCompact
    ? {
        margin: 0,
        fontSize: "0.9375rem",
        fontWeight: "600",
        color: "var(--text)",
        lineHeight: 1.3,
      }
    : {
        margin: "0 0 12px 0",
        fontSize: "clamp(1.375rem, 2vw, 1.625rem)",
        fontWeight: "600",
        color: "var(--text)",
        lineHeight: 1.2,
      };

  const messageStyle: React.CSSProperties = isCompact
    ? {
        margin: 0,
        color: "var(--muted)",
        fontSize: "0.8125rem",
        lineHeight: 1.4,
        maxWidth: "240px",
      }
    : {
        margin: "0 0 24px 0",
        color: "var(--muted)",
        fontSize: "0.9375rem",
        lineHeight: 1.5,
        maxWidth: "320px",
      };

  const buttonStyle: React.CSSProperties = isCompact
    ? {
        minHeight: "36px",
        minWidth: "120px",
        fontSize: "0.8125rem",
      }
    : {
        minHeight: "44px",
        minWidth: "160px",
      };

  return (
    <div
      style={wrapperStyle}
      data-testid={`empty-state-${variant}`}
      data-size={size}
    >
      <div
        aria-hidden="true"
        style={{
          width: illustrationSize,
          height: illustrationSize,
          margin: illustrationMargin,
          borderRadius: "50%",
          background: isCompact ? "var(--surface)" : "var(--surface-soft)",
          border: "1px solid var(--line)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <EmptyIllustration variant={variant} size={size} />
      </div>

      <HeadingTag style={headingStyle}>{finalTitle}</HeadingTag>

      <p style={messageStyle}>{finalMessage}</p>

      {action && (
        <button
          className={isCompact ? "ghost-button" : "primary-button"}
          onClick={action.onClick}
          style={buttonStyle}
          type="button"
        >
          {action.label}
        </button>
      )}

      {variant === "filtered" && onClearFilters && (
        <button
          className={isCompact ? "ghost-button" : "primary-button"}
          onClick={onClearFilters}
          style={buttonStyle}
          type="button"
          data-testid="empty-state-clear-filters"
        >
          {isCompact ? "Clear filters" : "Clear all filters"}
        </button>
      )}

      {variant === "error" && onRetry && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isCompact ? "8px" : "12px",
            alignItems: "center",
          }}
        >
          <button
            className="primary-button"
            onClick={handleRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
            type="button"
            style={buttonStyle}
          >
            {isRetrying ? "Retrying…" : "Retry"}
          </button>
          {!isCompact && (
            <ExternalLink
              href="https://status.callora.io"
              ariaLabel="Check system status"
              style={{
                fontSize: "0.875rem",
                color: "var(--accent)",
                textDecoration: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLAnchorElement).style.textDecoration =
                  "underline";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLAnchorElement).style.textDecoration = "none";
              }}
            >
              Check system status
            </ExternalLink>
          )}
        </div>
      )}
    </div>
  );
}
