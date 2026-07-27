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
