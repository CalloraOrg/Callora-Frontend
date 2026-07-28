import { useEffect, useRef, type ReactNode } from "react";

export interface LiveRegionProps {
  message?: string;
  assertive?: boolean;
  children?: ReactNode;
  "aria-live"?: "polite" | "assertive" | "off";
  role?: string;
  className?: string;
  id?: string;
  regionId?: string;
}

export default function LiveRegion({
  message,
  assertive = false,
  children,
  "aria-live": ariaLive,
  role,
  className = "sr-only",
  id,
  regionId,
}: LiveRegionProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const prevMessageRef = useRef(message);

  const effectiveLive = ariaLive ?? (assertive ? "assertive" : "polite");
  const effectiveRole = role ?? (assertive ? "alert" : "status");
  const effectiveId = id ?? regionId;

  useEffect(() => {
    if (!message) return;
    const el = regionRef.current;
    if (!el) return;

    // If the new message is identical to the previous one, append a
    // non-rendering space to force re-announcement.
    if (message === prevMessageRef.current) {
      el.textContent = message + "\u200A";
      requestAnimationFrame(() => {
        if (el) el.textContent = message;
      });
    } else {
      el.textContent = message;
    }
    prevMessageRef.current = message;
  }, [message]);

  return (
    <div
      id={effectiveId}
      ref={regionRef}
      role={effectiveRole}
      aria-live={effectiveLive}
      aria-atomic="true"
      className="sr-only"
      data-testid="live-region"
      aria-hidden={!message ? "true" : undefined}
    >
      {message}
    </div>
  );
}

