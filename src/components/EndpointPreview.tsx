/**
 * EndpointPreview.tsx
 *
 * A floating hover-and-focus preview card for an individual API endpoint.
 * Shows the HTTP method badge, URL, parameter table (name / type / required),
 * and an optional response-shape snippet — all without navigating away from
 * the endpoint list.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The trigger row receives `aria-describedby` pointing at the preview panel
 *   while the preview is open.
 * - The preview itself has `role="tooltip"` so assistive technology announces
 *   it as supplementary information rather than as a live region.
 * - `pointer-events: none` on the panel prevents mouse trapping.
 * - Pressing Escape closes the preview and returns focus-state cleanly.
 * - Colours come exclusively from design tokens, so both light and dark themes
 *   are covered automatically.
 *
 * Usage:
 * ```tsx
 * <EndpointPreview endpoint={ep} id={`preview-${ep.id}`}>
 *   <div className="endpoint-card-header">…</div>
 * </EndpointPreview>
 * ```
 */

import { useId, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EndpointParam = {
  name: string;
  type: string;
  required?: boolean;
};

export type EndpointPreviewData = {
  id: string;
  title: string;
  url: string;
  method: string;
  params: EndpointParam[];
  response?: string;
  group?: string;
};

type EndpointPreviewProps = {
  /** The endpoint whose schema should be shown in the preview panel. */
  endpoint: EndpointPreviewData;
  /**
   * The content that acts as the hover/focus trigger — typically an endpoint
   * card header row.  Receives `aria-describedby` while the preview is open.
   */
  children: React.ReactNode;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of parameters displayed in the compact preview table. */
const MAX_PREVIEW_PARAMS = 5;

// ── Component ─────────────────────────────────────────────────────────────────

export default function EndpointPreview({
  endpoint,
  children,
}: EndpointPreviewProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  /**
   * When the user presses Escape we suppress the next focus event so that
   * calling `.focus()` to return keyboard position does not immediately
   * re-open the panel.
   */
  const suppressNextFocus = useRef(false);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      suppressNextFocus.current = true;
      hide();
      // Return focus to the trigger so keyboard users aren't stranded.
      triggerRef.current?.focus();
    }
  };

  const visibleParams = endpoint.params.slice(0, MAX_PREVIEW_PARAMS);
  const hiddenParamCount = endpoint.params.length - visibleParams.length;
  const methodLower = (endpoint.method || "get").toLowerCase();

  return (
    <div
      className="endpoint-preview__wrapper"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {/* ── Trigger zone ───────────────────────────────────────────────── */}
      <div
        ref={triggerRef}
        className="endpoint-preview__trigger"
        aria-describedby={open ? panelId : undefined}
        onFocus={() => {
          if (suppressNextFocus.current) {
            suppressNextFocus.current = false;
            return;
          }
          show();
        }}
        onBlur={(event) => {
          // Only close if focus has left the entire wrapper subtree.
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            hide();
          }
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Preview schema for ${endpoint.title}`}
      >
        {children}
      </div>

      {/* ── Preview panel ──────────────────────────────────────────────── */}
      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="endpoint-preview__panel preview-card"
          aria-label={`${endpoint.title} schema preview`}
          /**
           * pointer-events: none ensures hovering over the panel itself does
           * not re-trigger onMouseLeave on the wrapper, which would close the
           * preview unexpectedly.  The panel is read-only so interaction is
           * not required.
           */
          style={{ pointerEvents: "none" }}
        >
          {/* Top-line: eyebrow label + method badge */}
          <div className="endpoint-preview__topline">
            <span className="endpoint-preview__eyebrow">Schema preview</span>
            <span
              className={`method-badge method-badge--${methodLower}`}
              aria-label={`${endpoint.method} method`}
            >
              {endpoint.method.toUpperCase()}
            </span>
          </div>

          {/* Endpoint title and URL */}
          <p className="endpoint-preview__title">{endpoint.title}</p>
          <code className="endpoint-preview__url">{endpoint.url}</code>

          {/* Parameter table */}
          {endpoint.params.length > 0 ? (
            <div className="endpoint-preview__params">
              <h6 className="endpoint-preview__section-label">Parameters</h6>
              <table className="endpoint-preview__table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Type</th>
                    <th scope="col">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParams.map((param) => (
                    <tr key={param.name}>
                      <td>
                        <code className="endpoint-preview__param-name">
                          {param.name}
                        </code>
                      </td>
                      <td>
                        <span className="type-tag">{param.type}</span>
                      </td>
                      <td>
                        {param.required ? (
                          <span
                            className="endpoint-preview__required"
                            aria-label="required"
                          >
                            Yes
                          </span>
                        ) : (
                          <span
                            className="endpoint-preview__optional"
                            aria-label="optional"
                          >
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hiddenParamCount > 0 && (
                <p className="endpoint-preview__overflow">
                  +{hiddenParamCount} more parameter
                  {hiddenParamCount === 1 ? "" : "s"} — see full docs
                </p>
              )}
            </div>
          ) : (
            <p className="endpoint-preview__no-params">No parameters.</p>
          )}

          {/* Response snippet (optional) */}
          {endpoint.response && (
            <div className="endpoint-preview__response">
              <h6 className="endpoint-preview__section-label">Response shape</h6>
              <pre className="endpoint-preview__response-pre">
                <code>{endpoint.response}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
