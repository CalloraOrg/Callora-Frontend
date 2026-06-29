import Tooltip from "./Tooltip";

/**
 * PlanBadge — a small pill that labels an API/account plan tier and, on
 * hover / focus / long-press, explains the tier with its rate-limit details
 * via an accessible {@link Tooltip} (issue #283).
 */

export type PlanTier = "free" | "pro" | "enterprise";

type PlanMeta = {
  label: string;
  /** Human-readable rate limit shown in the tooltip. */
  rateLimit: string;
  description: string;
  /** Token names that resolve to theme-aware colours. */
  bg: string;
  fg: string;
};

const PLAN_META: Record<PlanTier, PlanMeta> = {
  free: {
    label: "Free",
    rateLimit: "60 requests / minute",
    description: "Best for prototyping and evaluation.",
    bg: "var(--plan-free-bg, #e5e7eb)",
    fg: "var(--plan-free-fg, #374151)",
  },
  pro: {
    label: "Pro",
    rateLimit: "1,000 requests / minute",
    description: "Higher throughput and priority support for production apps.",
    bg: "var(--plan-pro-bg, #dbeafe)",
    fg: "var(--plan-pro-fg, #1e40af)",
  },
  enterprise: {
    label: "Enterprise",
    rateLimit: "Custom / unmetered",
    description: "Dedicated capacity, SLAs, and custom rate limits.",
    bg: "var(--plan-enterprise-bg, #ede9fe)",
    fg: "var(--plan-enterprise-fg, #5b21b6)",
  },
};

type PlanBadgeProps = {
  tier: PlanTier;
  className?: string;
};

export default function PlanBadge({
  tier,
  className,
}: PlanBadgeProps): JSX.Element {
  const meta = PLAN_META[tier];

  const tooltipContent = (
    <span>
      <strong style={{ display: "block", marginBottom: "0.25rem" }}>
        {meta.label} plan
      </strong>
      <span style={{ display: "block" }}>{meta.description}</span>
      <span style={{ display: "block", marginTop: "0.25rem", opacity: 0.85 }}>
        Rate limit: {meta.rateLimit}
      </span>
    </span>
  );

  return (
    <Tooltip content={tooltipContent}>
      <span
        className={className}
        tabIndex={0}
        aria-label={`${meta.label} plan. Rate limit: ${meta.rateLimit}.`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0.125rem 0.5rem",
          borderRadius: "999px",
          fontSize: "0.6875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          cursor: "default",
          background: meta.bg,
          color: meta.fg,
        }}
      >
        {meta.label}
      </span>
    </Tooltip>
  );
}
