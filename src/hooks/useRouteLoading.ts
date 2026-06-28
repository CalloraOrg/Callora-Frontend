import { useEffect, useRef, useState } from "react";

const LOADING_START_EVENT = "rl-start";
const LOADING_END_EVENT = "rl-end";

export function startRouteLoading() {
  window.dispatchEvent(new CustomEvent(LOADING_START_EVENT));
}

export function stopRouteLoading() {
  window.dispatchEvent(new CustomEvent(LOADING_END_EVENT));
}

export function useRouteLoading(): boolean {
  const [loading, setLoading] = useState(false);
  const activeLoads = useRef(0);

  useEffect(() => {
    const handleStart = () => {
      activeLoads.current += 1;
      setLoading(true);
    };

    const handleEnd = () => {
      activeLoads.current = Math.max(0, activeLoads.current - 1);
      if (activeLoads.current === 0) {
        setLoading(false);
      }
    };

    window.addEventListener(LOADING_START_EVENT, handleStart);
    window.addEventListener(LOADING_END_EVENT, handleEnd);

    return () => {
      window.removeEventListener(LOADING_START_EVENT, handleStart);
      window.removeEventListener(LOADING_END_EVENT, handleEnd);
    };
  }, []);

  return loading;
}
