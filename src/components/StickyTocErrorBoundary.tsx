import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import type { ReactNode } from "react";

/**
 * A polished error-boundary wrapper for the StickyToc (ApiDetailStickyTOC) component.
 *
 * Features:
 * - Renders an accessible, themed fallback with an error icon, descriptive message,
 *   error details (in dev), and a retry button when the TOC fails to render.
 * - Follows WCAG 2.1 AA: `role="alert"`, `aria-live="polite"`, keyboard-focusable retry.
 * - Dark-mode aware via CSS custom properties and class toggling.
 * - Shows error details in development mode for debugging.
 *
 * @example
 * ```tsx
 * <StickyTocErrorBoundary>
 *   <StickyToc sections={sections} />
 * </StickyTocErrorBoundary>
 * ```
 */
export function StickyTocErrorBoundary({ children }: { children: ReactNode }) {
  const fallback = (error: Error, retry: () => void) => (
    <div
      className="sticky-toc-error-fallback"
      role="alert"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        padding: "2rem 1.5rem",
        borderRadius: "12px",
        background: "var(--color-surface-raised, #f8f9fb)",
        border: "1px solid var(--color-border-subtle, #e5e7eb)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
        textAlign: "center",
        maxWidth: "320px",
        margin: "0 auto",
      }}
    >
      {/* Error icon */}
      <div aria-hidden="true" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {/* Message */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--color-text-primary, #111827)",
          }}
        >
          Table of contents unavailable
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "0.8125rem",
            color: "var(--color-text-secondary, #6b7280)",
            lineHeight: 1.5,
          }}
        >
          The page structure could not be loaded. This may be temporary.
        </p>
      </div>

      {/* Error detail (dev only) */}
      {process.env.NODE_ENV === "development" && (
        <details
          style={{
            width: "100%",
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary, #9ca3af)",
            textAlign: "left",
            background: "var(--color-surface-inset, #f3f4f6)",
            borderRadius: "8px",
            padding: "0.5rem 0.75rem",
            overflow: "auto",
            maxHeight: "120px",
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 500 }}>
            Error details
          </summary>
          <pre
            style={{
              margin: "0.25rem 0 0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.message}
          </pre>
        </details>
      )}

      {/* Retry button */}
      <button
        type="button"
        onClick={retry}
        className="sticky-toc-retry-button"
        aria-label="Retry loading table of contents"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.5rem 1.25rem",
          fontSize: "0.8125rem",
          fontWeight: 500,
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          color: "#fff",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          boxShadow: "0 1px 3px rgba(99, 102, 241, 0.3)",
          transition: "opacity 0.15s, transform 0.1s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.9";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline =
            "2px solid var(--color-focus-ring, #6366f1)";
          (e.currentTarget as HTMLButtonElement).style.outlineOffset = "2px";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "none";
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
          aria-hidden="true"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Retry
      </button>
    </div>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      message="Failed to render table of contents."
    >
      {children}
    </ErrorBoundary>
  );
}

export default StickyTocErrorBoundary;
