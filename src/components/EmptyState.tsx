import React, { useCallback } from "react";
import ExternalLink from "./ExternalLink";
import { useCopy } from "../hooks/useCopy";
import { EmptyStateSkeleton } from "./Skeleton";

export type EmptyStateVariant =
  | "empty"
  | "api-detail"
  | "filtered"
  | "error"
  | "plan-badge"
  | "risk-gauge"
  | "quota-banner";
export type EmptyStateSize = "default" | "compact";

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  size?: EmptyStateSize;
  title?: string;
  message?: string;
  /** @deprecated Use `message` instead */
  description?: string;
  /**
   * Optional `id` applied to the heading so parent regions can wire
   * `aria-labelledby` (WCAG 1.3.1 / 4.1.2). Used by QuotaBanner empty state.
   */
  headingId?: string;
  onClearFilters?: () => void;
  onRetry?: () => void | Promise<void>;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  loading?: boolean;
  /** When true, renders a copy-to-clipboard button for the message text. */
  copyable?: boolean;
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

  if (variant === "api-card") {
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
          x="16"
          y="16"
          width="32"
          height="32"
          rx="4"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          strokeDasharray="4 4"
        />
        <path
          d="M24 32h16"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
        />
        <path
          d="M32 24v16"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
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

  if (variant === "plan-badge") {
    // Illustration: a tiered medal/ribbon motif representing plan tiers,
    // with an accent sparkle to suggest "upgrade potential".
    // Uses --plan-free-bg, --plan-pro-fg, --plan-enterprise-fg tokens
    // that are already defined by the PlanBadge component.
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
        {/* Medal circle */}
        <circle
          cx="32"
          cy="30"
          r="14"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        {/* Inner medal ring (accent) */}
        <circle
          cx="32"
          cy="30"
          r="9"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
        />
        {/* Ribbon left */}
        <path
          d="M26 43L20 54l6-2 4 4 3-8"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Ribbon right */}
        <path
          d="M38 43L44 54l-6-2-4 4-3-8"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Star / tier symbol in centre */}
        <path
          d="M32 23l1.5 4.5H38l-3.8 2.8 1.5 4.5L32 32l-3.7 2.8 1.5-4.5L26 27.5h4.5z"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
          fill="none"
        />
        {/* Decorative sparkle dots — tier-colour accents */}
        <circle cx="14" cy="16" r="1.5" fill="var(--accent)" stroke="none" />
        <circle cx="50" cy="13" r="1.25" fill="var(--accent)" stroke="none" />
        {/* Subtle top dashes — upgrade-path metaphor */}
        <path
          d="M10 10h12M18 6h8"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.7}
          strokeDasharray={size === "compact" ? "2 2" : "3 3"}
          opacity="0.5"
        />
      </svg>
    );
  }

  if (variant === "risk-gauge") {
    const cx = 32;
    const cy = 34;
    const r = 20;
    const startAngle = -210;
    const endAngle = 30;

    function polar(angle: number, radius: number) {
      const rad = ((angle - 90) * Math.PI) / 180;
      return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    }

    const arcStart = polar(startAngle, r);
    const arcEnd = polar(endAngle, r);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

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
        {/* Gauge arc track */}
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.7}
          opacity="0.35"
        />
        {/* Gauge arc fill (lower half — safer zone) */}
        <path
          d={`M ${cx} ${cy} L ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 0 1 ${cx} ${cy + 6} Z`}
          stroke="var(--accent)"
          strokeWidth={accentStroke * 0.5}
          opacity="0.5"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + 3}
          y2={cy - r + 4}
          stroke="var(--accent)"
          strokeWidth={accentStroke}
        />
        <circle cx={cx} cy={cy} r={3} stroke="var(--accent)" strokeWidth={accentStroke} />
        {/* Shield outline behind the gauge */}
        <path
          d="M32 6l14 7v12c0 10.5-5.6 19.2-14 23-8.4-3.8-14-12.5-14-23V13l14-7z"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.8}
          opacity="0.6"
        />
        {/* Decorative sparkle dots */}
        <circle cx="16" cy="12" r="1.5" fill="var(--accent)" stroke="none" />
        <circle cx="48" cy="14" r="1.25" fill="var(--accent)" stroke="none" />
        <path
          d="M52 48l2 2M54 52l1.5 1.5"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
        />
      </svg>
    );
  }

  if (variant === "quota-banner") {
    // Illustration: quota meter (gauge + needle) beside usage bars —
    // metaphor for "usage limits not yet configured". Accent marks are
    // decorative only (WCAG 1.4.1); title + message carry meaning.
    // All strokes/fills use design tokens for light/dark consistency.
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
        {/* Gauge arc — quota meter track */}
        <path
          d="M14 38 A 14 14 0 0 1 36 38"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        {/* Partial fill arc — unused capacity hint */}
        <path
          d="M18 38 A 10 10 0 0 1 32 38"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
          opacity="0.6"
        />
        {/* Needle pointing at ~60% */}
        <line
          x1="25" y1="38" x2="21" y2="29"
          stroke="var(--accent)"
          strokeWidth={accentStroke}
        />
        <circle cx="25" cy="38" r="2" fill="var(--accent)" stroke="none" />

        {/* Vertical divider between meter and bars */}
        <line
          x1="42" y1="14" x2="42" y2="52"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.5}
          opacity="0.3"
          strokeDasharray="2 3"
        />

        {/* Usage bar chart — empty / unfilled quota metaphor */}
        <rect
          x="46" y="26" width="5" height="24" rx="1.5"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.85}
        />
        <rect
          x="53" y="34" width="5" height="16" rx="1.5"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.85}
        />
        <rect
          x="46" y="36" width="5" height="14" rx="1.5"
          fill="var(--accent)"
          fillOpacity="0.2"
          stroke="none"
        />

        {/* Baseline under bars */}
        <line
          x1="46" y1="50" x2="58" y2="50"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.5}
          opacity="0.4"
        />

        {/* Decorative sparkle dots — Stellar Wave accent */}
        <circle cx="10" cy="12" r="1.5" fill="var(--accent)" stroke="none" />
        <circle cx="56" cy="14" r="1.25" fill="var(--accent)" stroke="none" />
        <path
          d="M8 8h4"
          stroke="var(--muted)"
          strokeWidth={strokeWidth * 0.6}
          strokeDasharray="1.5 2"
          opacity="0.5"
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
 * Compact copy-to-clipboard line rendered alongside the EmptyState message.
 * Provides success feedback for assistive technology via aria-live.
 */
function MessageWithCopy({
  message,
  isCompact,
}: {
  message: string;
  isCompact: boolean;
}) {
  const { handleCopy: copyToClipboard, copied, supported } = useCopy();
  const [liveFeedback, setLiveFeedback] = React.useState("");

  const handleCopy = useCallback(() => {
    copyToClipboard(message).then((ok) => {
      if (ok) {
        setLiveFeedback("Message copied.");
        setTimeout(() => setLiveFeedback(""), 2000);
      }
    });
  }, [copyToClipboard, message]);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    gap: isCompact ? "6px" : "8px",
    alignItems: "flex-start",
    justifyContent: "center",
    maxWidth: isCompact ? "240px" : "320px",
  };

  const messageStyle: React.CSSProperties = isCompact
    ? {
        margin: 0,
        color: "var(--muted)",
        fontSize: "0.8125rem",
        lineHeight: 1.4,
      }
    : {
        margin: "0 0 24px 0",
        color: "var(--muted)",
        fontSize: "0.9375rem",
        lineHeight: 1.5,
      };

  const btnStyle: React.CSSProperties = {
    flexShrink: 0,
    background: "none",
    border: "1px solid var(--line)",
    borderRadius: "4px",
    cursor: "pointer",
    padding: "2px 6px",
    fontSize: isCompact ? "0.7rem" : "0.75rem",
    color: "var(--accent)",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    marginTop: isCompact ? 0 : "2px",
    transition: "color 0.15s ease, border-color 0.15s ease",
  };

  if (!supported) {
    return (
      <p
        style={messageStyle}
        data-testid="empty-state-message"
      >
        {message}
      </p>
    );
  }

  return (
    <div style={containerStyle}>
      <p style={messageStyle} data-testid="empty-state-message">
        {message}
      </p>
      <button
        type="button"
        style={btnStyle}
        onClick={handleCopy}
        aria-label={`Copy "${message}"`}
        data-testid="empty-state-copy-button"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      {/* Screen-reader announcement for copy feedback (WCAG 4.1.3) */}
      {liveFeedback && (
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveFeedback}
        </span>
      )}
    </div>
  );
}

/**
 * EmptyState component with distinct variants for different marketplace states.
 *
 * Variants:
 * - empty:      Default state when no APIs exist in the marketplace.
 * - api-detail: A requested API listing is unavailable. Uses an API-card illustration.
 * - filtered:   Active filters yield zero results. Shows a "Clear all filters" CTA.
 *               Used inline inside FiltersSidebar (compact) and the results grid (default).
 * - error:      Network/fetch failure. Shows a "Retry" button plus a status link.
 * - plan-badge: No plan/tier is attached to the current API or account.
 *               Shows a medal-and-ribbon illustration with a "Choose a plan" CTA
 *               so users can select a tier (free/pro/enterprise) and begin receiving
 *               calls.  Used by the PlanBadge page (issue #529).
 * - risk-gauge: No risk assessment data is available yet.
 *               Shows a shield-and-gauge illustration with a "Run assessment" CTA
 *               so users can evaluate their API risk profile.  Used by the
 *               RiskGauge page (issue #664).
 * - quota-banner: No quota data is configured yet.
 *                 Shows a gauge-and-bars illustration with a "Set up quota" CTA
 *                 so users can configure usage limits.  Used by the QuotaBanner
 *                 component (issue #702 / b#025; also #742).
 *                 Supports optional `headingId` so the parent region can wire
 *                 `aria-labelledby` to the empty-state heading.
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
  description,
  headingId,
  onClearFilters,
  onRetry,
  action,
  secondaryAction,
  loading = false,
  copyable = false,
}: EmptyStateProps) {
  const resolvedMessage = message ?? description;
  const resolvedAction = action;
  const { copy: handleCopy, copied } = useCopy();

  if (loading) {
    return (
      <EmptyStateSkeleton
        size={size}
        hasAction={!!resolvedAction || (variant === "filtered" && !!onClearFilters) || (variant === "error" && !!onRetry)}
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
    "api-card": {
      title: "API unavailable",
      message: "This API could not be loaded or is currently unavailable.",
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
    /**
     * plan-badge variant — shown on the PlanBadge page when no plan data
     * is associated with the current account/API.  The CTA guides users
     * toward choosing a plan (issue #529).
     */
    "plan-badge": {
      title: "No plan selected",
      message:
        size === "compact"
          ? "Choose a plan to unlock API access."
          : "This API doesn't have a plan attached yet. Select a plan tier to set rate limits and start receiving calls.",
    },
    /**
     * risk-gauge variant — shown on the RiskGauge page when no risk
     * assessment data is available yet.  The CTA guides users toward
     * running their first risk assessment (issue #664).
     */
    "risk-gauge": {
      title: "No risk data yet",
      message:
        size === "compact"
          ? "Run an assessment to evaluate your API risk profile."
          : "Run a risk assessment to evaluate your API's security, reliability, and compliance posture.",
    },
    /**
     * quota-banner variant — shown on the QuotaBanner component when no
     * quota data is configured yet.  The CTA guides users to set up their
     * first quota (issue #702 / b#025).
     */
    "quota-banner": {
      title: "No quota configured",
      message:
        size === "compact"
          ? "Set a quota to track your API usage limits."
          : "No quota has been configured for this API yet. Set a quota to track and manage your usage limits.",
    },
  };

  const finalTitle = title ?? defaults[variant].title;
  const finalMessage = resolvedMessage ?? defaults[variant].message;
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

      <HeadingTag id={headingId} style={headingStyle}>
        {finalTitle}
      </HeadingTag>

      <MessageWithCopy message={finalMessage} isCompact={isCompact} />

      {copyable && finalMessage && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="ghost-button"
            onClick={() => handleCopy(finalMessage)}
            aria-label="Copy message to clipboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: isCompact ? "0.75rem" : "0.8125rem",
              padding: isCompact ? "0.25rem 0.5rem" : "0.3125rem 0.75rem",
              color: copied ? "var(--success, #10b981)" : "var(--muted)",
              minHeight: "36px",
            }}
          >
            <span aria-hidden="true">
              {copied ? "✓" : "⧉"}
            </span>
            {copied ? "Copied" : "Copy"}
          </button>
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              margin: "-1px",
              padding: 0,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {copied ? "Message copied to clipboard" : ""}
          </span>
        </div>
      )}

      {resolvedAction && (
        <button
          className={isCompact ? "ghost-button" : "primary-button"}
          onClick={resolvedAction.onClick}
          style={buttonStyle}
          type="button"
        >
          {resolvedAction.label}
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
