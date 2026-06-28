import { useEffect, useRef, useState } from "react";
import { useRouteLoading } from "../hooks/useRouteLoading";

export default function RouteProgressBar() {
  const isLoading = useRouteLoading();
  const [visible, setVisible] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isLoading) {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      setVisible(true);
    } else {
      exitTimer.current = setTimeout(() => setVisible(false), 240);
    }
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      className={`route-progress-bar${isLoading ? " route-progress-bar--active" : ""}`}
      role="progressbar"
      aria-label="Page loading"
      aria-busy={isLoading}
    >
      <div className="route-progress-bar-track">
        <div className="route-progress-bar-indicator" />
      </div>
    </div>
  );
}
