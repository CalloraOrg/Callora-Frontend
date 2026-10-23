import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useRouteLoading } from "../hooks/useRouteLoading";

export default function RouteProgressBar() {
  const isLoading = useRouteLoading();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isLoading) {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      setVisible(true);
    } else {
      exitTimer.current = setTimeout(
        () => setVisible(false),
        prefersReducedMotion ? 0 : 240,
      );
    }
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [isLoading, prefersReducedMotion]);

  if (!visible) return null;

  return (
    <div
      className={`route-progress-bar no-print${isLoading ? " route-progress-bar--active" : ""}`}
      role="progressbar"
      aria-label="Page loading"
      aria-busy={isLoading}
    >
      <div className="route-progress-bar-glow" aria-hidden="true" />
      <div className="route-progress-bar-track">
        <div className="route-progress-bar-indicator" />
      </div>
    </div>
  );
}
