/**
 * useReducedMotion
 *
 * Returns `true` when the user's OS/browser has
 * `prefers-reduced-motion: reduce` set, and `false` otherwise.
 *
 * The hook subscribes to changes so the value stays in sync if the
 * preference is toggled while the page is open (e.g. via system settings).
 *
 * Usage:
 *   const reducedMotion = useReducedMotion();
 *   // suppress transform/transition classes when true
 */

import { useEffect, useState } from "react";

/** Media query string for the reduced-motion preference. */
const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  // Initialise from the media query so there is no first-render flash.
  const [matches, setMatches] = useState<boolean>(() => {
    // window.matchMedia may be unavailable in SSR / test environments that
    // do not mock it.  Fall back to `false` (full-motion) in that case.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia(QUERY);

    // Keep state in sync with live changes (e.g. user toggles OS setting).
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Use the modern addEventListener API where available; fall back to the
    // deprecated addListener for older browsers.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mql as any).addListener(handler);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return () => (mql as any).removeListener(handler);
    }
  }, []);

  return matches;
}
