import React from "react";

type ExternalLinkProps = React.ComponentPropsWithoutRef<"a"> & {
  children: React.ReactNode;
};

function isExternal(href?: string): boolean {
  if (!href) return false;
  if (href.startsWith("#") || href.startsWith("/") || href.startsWith("?") || href.startsWith("./") || href.startsWith("../")) {
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

export default function ExternalLink({
  href,
  children,
  ...rest
}: ExternalLinkProps) {
  const external = isExternal(href);
  const baseAriaLabel = (rest as Record<string, unknown>)["aria-label"] as string | undefined;
  const ariaLabel = external
    ? `${baseAriaLabel ?? ""}${baseAriaLabel ? ", " : ""}opens in new tab`
    : baseAriaLabel;

  const anchorProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = {
    ...rest,
    href,
    "aria-label": ariaLabel,
  };

  if (external) {
    anchorProps.target = "_blank";
    anchorProps.rel = "noopener noreferrer";
  }

  return (
    <a {...anchorProps}>
      {children}
      {external && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginLeft: 4,
            verticalAlign: "middle",
            color: "var(--muted)",
            lineHeight: 1,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </span>
      )}
      <style>{`
        a:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          box-shadow: var(--focus-ring);
          border-radius: 4px;
        }
      `}</style>
    </a>
  );
}
