import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFetchTracker } from "../hooks/useFetchTracker";

export default function TopProgressBar() {
  const { isFetching } = useFetchTracker();
  const [visible, setVisible] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isFetching) {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      setVisible(true);
    } else {
      exitTimer.current = setTimeout(() => setVisible(false), 240);
    }
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [isFetching]);

  if (!visible) return null;

  return createPortal(
    <div
      className={`top-progress-bar${isFetching ? " top-progress-bar--active" : ""}`}
      role="progressbar"
      aria-label="Fetching data"
      aria-busy={isFetching}
    >
      <div className="top-progress-bar-track">
        <div className="top-progress-bar-indicator" />
      </div>
    </div>,
    document.body,
  );
}
