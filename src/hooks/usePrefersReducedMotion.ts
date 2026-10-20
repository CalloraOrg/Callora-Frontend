import { useSyncExternalStore } from "react";

/** Media query used to detect the OS-level reduced-motion preference. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Current value of `(prefers-reduced-motion: reduce)`.
 *
 * Safe in SSR and in environments where `window.matchMedia` is absent
 * (jsdom without a stub, old WebViews): both return `false` so callers can
 * always branch on a boolean.
 */
function getPrefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Subscribes to preference changes.
 *
 * Uses the modern `MediaQueryList.addEventListener` API and falls back to the
 * legacy `addListener` API for older engines. Returns a no-op unsubscribe in
 * environments without `matchMedia`.
 */
function subscribePrefersReducedMotion(onStoreChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  const mql = window.matchMedia(REDUCED_MOTION_QUERY);

  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onStoreChange);
    return () => mql.removeEventListener("change", onStoreChange);
  }

  if (typeof mql.addListener === "function") {
    mql.addListener(onStoreChange);
    return () => mql.removeListener(onStoreChange);
  }

  return () => {};
}

/**
 * Reactive access to the OS-level `prefers-reduced-motion` setting.
 *
 * The value updates the moment the preference changes (no re-subscription or
 * polling needed), so data transitions that branch on it — skeleton loading,
 * spinners, transitions, scroll behavior — react immediately without a reload.
 *
 * @example
 *   const prefersReducedMotion = usePrefersReducedMotion();
 *   const delay = prefersReducedMotion ? 0 : LOADING_DELAY_MS;
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotion,
    () => false,
  );
}