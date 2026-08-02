import { type ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
}

/**
 * StickyTocErrorBoundary
 *
 * An error boundary specifically for the sticky table-of-contents section on
 * ApiDetailPage. Uses the reusable {@link ErrorBoundary} component with a
 * custom, polished fallback that shows the TOC heading, a danger icon, a
 * descriptive message, and a retry button.
 *
 * **Accessibility (WCAG 2.1 AA)**
 * - The fallback container has `role="alert"` and `aria-live="polite"` so
 *   screen-readers announce the error without interrupting the user.
 * - The retry button has a descriptive `aria-label`.
 * - The icon is hidden from assistive technology (`aria-hidden="true"`).
 *
 * **Responsive**
 * - The fallback scales naturally within the TOC container; the
 *   `error-boundary-fallback` class ensures a 140 px min-height and
 *   centered layout.
 */
export function StickyTocErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundary
      fallback={(_error, retry) => (
        <div
          className="api-detail-toc"
          role="alert"
          aria-live="polite"
        >
          <p className="api-detail-toc__heading">Table of Contents</p>
          <div className="error-boundary-fallback">
            <div className="error-boundary-fallback__icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="error-boundary-fallback__message">
              Unable to load the table of contents.
            </p>
            <div className="error-boundary-fallback__action">
              <button
                className="ghost-button"
                type="button"
                onClick={retry}
                aria-label="Retry loading table of contents"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}