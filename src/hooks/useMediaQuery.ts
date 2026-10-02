import { useCallback, useSyncExternalStore } from "react";

/**
 * Reactive CSS media-query matcher.
 *
 * Returns `false` in SSR and in environments without `window.matchMedia`
 * (jsdom without a stub, old WebViews), so callers can always branch on a
 * boolean and default to the desktop rendering.
 *
 * @example
 *   const isMobile = useMediaQuery("(max-width: 768px)");
 */
export function useMediaQuery(query: string): boolean {
  // Identity must be stable across renders, or React resubscribes on every one.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }

      const mql = window.matchMedia(query);

      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onStoreChange);
        return () => mql.removeEventListener("change", onStoreChange);
      }

      if (typeof mql.addListener === "function") {
        mql.addListener(onStoreChange);
        return () => mql.removeListener(onStoreChange);
      }

      return () => {};
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
