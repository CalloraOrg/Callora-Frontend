/**
 * LiveRegion — a reusable screen-reader-only aria-live region for announcing
 * dynamic state changes to assistive technology.
 *
 * Usage:
 *   <LiveRegion>{announcementText}</LiveRegion>
 *
 * Accessibility notes:
 *   - The element is visually hidden (.sr-only) but remains available to
 *     the accessibility tree.
 *   - `aria-live="polite"` is the default — it queues the announcement
 *     behind the current speech queue.
 *   - `aria-atomic="true"` ensures the entire message is read as one unit.
 */

import { ReactNode } from "react";

interface LiveRegionProps {
  children?: ReactNode;
  "aria-live"?: "polite" | "assertive" | "off";
  role?: string;
  className?: string;
  id?: string;
}

export default function LiveRegion({
  children,
  "aria-live": ariaLive = "polite",
  role = "status",
  className = "sr-only",
  id,
}: LiveRegionProps) {
  return (
    <div
      id={id}
      className={className}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
