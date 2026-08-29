import React from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";

/**
 * ExternalLink component
 *
 * A wrapper around <a> that automatically detects external links and applies
 * security attributes (target="_blank", rel="noopener noreferrer"), visual
 * affordance (external link icon), and accessible labeling for screen readers.
 *
 * For same-origin relative links (/, #, ./), no external styling is applied.
 *
 * @example
 * <ExternalLink href="https://example.com">Learn more</ExternalLink>
 * // Renders: <a href="..." target="_blank" rel="noopener noreferrer">
 * //            Learn more <ExternalLinkIcon />
 * //          </a>
 *
 * @param href - Link URL (required)
 * @param children - Link text/content (required)
 * @param hideIcon - Opt out of icon display (default: false). Use only if your
 *                   link already has sufficient affordance (rare).
 * @param ariaLabel - Override the default aria-label for external links
 * @param ...rest - Standard anchor props (className, id, onClick, etc.)
 */
type ExternalLinkProps = React.ComponentPropsWithoutRef<"a"> & {
  children: React.ReactNode;
  hideIcon?: boolean;
  ariaLabel?: string;
};

function isExternal(href?: string): boolean {
  if (!href) return false;
  if (
    href.startsWith("#") ||
    href.startsWith("/") ||
    href.startsWith("?") ||
    href.startsWith("./") ||
    href.startsWith("../")
  ) {
    return false;
  }
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const absolute = new URL(href, origin);
    return absolute.origin !== origin;
  } catch {
    return false;
  }
}

/**
 * Composes aria-label for external links: includes user-provided label
 * plus "opens in new tab" suffix for screen reader clarity.
 */
function composeAriaLabel(
  isExternal: boolean,
  providedLabel: string | undefined
): string | undefined {
  if (!isExternal) return providedLabel;
  const suffix = "opens in new tab";
  if (!providedLabel) return suffix;
  return `${providedLabel}, ${suffix}`;
}

export default function ExternalLink({
  href,
  children,
  hideIcon = false,
  ariaLabel: customAriaLabel,
  ...rest
}: ExternalLinkProps) {
  const external = isExternal(href);
  const computedAriaLabel = composeAriaLabel(external, customAriaLabel);

  const anchorProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
    ...rest,
    href,
  };

  // Only set aria-label if we have one; undefined is cleaner than null
  if (computedAriaLabel) {
    anchorProps["aria-label"] = computedAriaLabel;
  }

  if (external) {
    anchorProps.target = "_blank";
    anchorProps.rel = "noopener noreferrer";
  }

  return (
    <a {...anchorProps}>
      {children}
      {external && !hideIcon && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginLeft: "0.25em",
            marginRight: "0",
            verticalAlign: "0.125em",
            lineHeight: 1,
          }}
        >
          <ExternalLinkIcon
            size={14}
            strokeWidth={2.5}
            style={{
              color: "var(--muted)",
              flexShrink: 0,
            }}
          />
        </span>
      )}
    </a>
  );
}
