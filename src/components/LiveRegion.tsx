import { useEffect, useRef } from "react";

/**
 * LiveRegion — a reusable aria-live region for announcing dynamic content
 * changes to assistive technology (screen readers).
 *
 * Usage:
 * ```tsx
 * <LiveRegion
 *   regionId="filters-status"
 *   message={announcementText}
 *   assertive={false}
 * />
 * ```
 *
 * The component renders a visually-hidden `aria-live` region that updates
 * its text content whenever `message` changes.  A small delay is added to
 * coalesce rapid updates (e.g. multiple filter toggles in quick succession).
 *
 * WCAG 2.1 AA compliance notes:
 *   • 4.1.3 Status Messages — region uses role="status" (polite) by default
 *   • 4.1.2 Name, Role, Value — the live region is programmatically
 *     associated with the controlling element when `labelledBy` is provided
 */
export default function LiveRegion({
  regionId,
  message,
  assertive = false,
  labelledBy,
  debounceMs = 300,
}: {
  /** Unique id for the live region element. */
  regionId: string;
  /** The message to announce.  Empty string clears the region silently. */
  message: string;
  /** Use assertive priority for time-critical updates (use sparingly). */
  assertive?: boolean;
  /** Optional aria-labelledby reference for associating with a control. */
  labelledBy?: string;
  /** Debounce interval in ms to coalesce rapid updates. */
  debounceMs?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const prevMessageRef = useRef<string>("");

  useEffect(() => {
    // Skip initial render — don't announce an empty message on mount.
    if (message === prevMessageRef.current) return;

    // Debounce: cancel any pending update so rapid changes coalesce.
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (regionRef.current) {
        regionRef.current.textContent = message || "";
      }
      prevMessageRef.current = message;
    }, message ? debounceMs : 0);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, debounceMs]);

  return (
    <div
      ref={regionRef}
      id={regionId}
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      aria-labelledby={labelledBy}
      className="sr-only"
      data-testid={`live-region-${regionId}`}
    />
  );
}
