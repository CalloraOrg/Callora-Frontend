/**
 * LiveRegion — a reusable screen-reader-only aria-live region for announcing
 * dynamic state changes to assistive technology.
 *
 * Usage:
 *   <LiveRegion message={announcementText} />
 *
 * When `message` is non-empty, the region's textContent updates and the
 * polite live region causes most screen readers to announce the new text
 * without interrupting the current task.
 *
 * Props:
 *   message  – The string to announce.  Pass an empty string to silence.
 *   assertive – Optional; use `role="alert"` (aria-live="assertive") for
 *               time-sensitive announcements (default: polite).
 *
 * Accessibility notes:
 *   - The element is visually hidden (.sr-only) but remains available to
 *     the accessibility tree.
 *   - `aria-live="polite"` is the default — it queues the announcement
 *     behind the current speech queue.
 *   - `aria-atomic="true"` ensures the entire message is read as one unit
 *     instead of diffing against the previous content.
 *   - When the message changes but the new message is the same string, the
 *     region uses a trailing space trick to force re-announcement.
 */

import { useEffect, useRef } from "react";

interface LiveRegionProps {
  message: string;
  assertive?: boolean;
  regionId?: string;
}

export default function LiveRegion({ message, assertive = false, regionId }: LiveRegionProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const prevMessageRef = useRef(message);

  useEffect(() => {
    if (!message) return;
    const el = regionRef.current;
    if (!el) return;

    // If the new message is identical to the previous one, append a
    // non-rendering space to force re-announcement.
    if (message === prevMessageRef.current) {
      el.textContent = message + "\u200A";
      // Restore the real text after a tick so future re-announcements work.
      requestAnimationFrame(() => {
        el.textContent = message;
      });
    } else {
      el.textContent = message;
    }
    prevMessageRef.current = message;
  }, [message]);

  return (
    <div
      ref={regionRef}
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
      data-testid={regionId ? `live-region-${regionId}` : "live-region"}
      aria-hidden={!message ? "true" : undefined}
    >
      {message}
    </div>
  );
}
