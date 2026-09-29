/**
 * Session-expiry signal bus.
 *
 * The API layer learns that a session has died from an HTTP status code, but
 * the surface that has to react to it (a banner in the React tree) is nowhere
 * near the call site. This module is the seam between the two: request code
 * calls {@link signalExpiry}, the UI subscribes through
 * `useSessionExpiry` / `SessionExpiryBanner`.
 *
 * The state is module-level on purpose — an expired session is app-wide, not
 * scoped to whichever component happened to make the request.
 */

/** Why the session was considered expired. */
export type SessionExpiryReason = 'unauthorized' | 'expired';

export type SessionExpiryEvent = {
  reason: SessionExpiryReason;
  /** Unix epoch milliseconds, for logs and de-duplication. */
  at: number;
};

type ChangeListener = () => void;

const listeners = new Set<ChangeListener>();

/** Last event, or null when the session is currently considered valid. */
let lastEvent: SessionExpiryEvent | null = null;

function notify(): void {
  // Copy before iterating: a listener may unsubscribe during dispatch.
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // One bad subscriber must not stop the rest from being notified.
    }
  }
}

/**
 * Report that the caller's credentials are no longer accepted.
 *
 * Safe to call repeatedly — a burst of parallel 401s collapses into a single
 * notification, because the stored event is a new object only when the state
 * actually changes.
 */
export function signalExpiry(reason: SessionExpiryReason = 'expired'): void {
  if (lastEvent !== null && lastEvent.reason === reason) {
    // Already expired for the same reason; nothing observable changed.
    return;
  }
  lastEvent = { reason, at: Date.now() };
  notify();
}

/**
 * Subscribe to session-expiry state changes.
 *
 * The listener takes no arguments — read the current state with
 * {@link getSessionExpiry}. This shape matches the contract React's
 * `useSyncExternalStore` expects.
 *
 * @returns an unsubscribe function; safe to call more than once.
 */
export function subscribeSessionExpiry(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current session state, or null when the session is valid. */
export function getSessionExpiry(): SessionExpiryEvent | null {
  return lastEvent;
}

/**
 * Clear the expired state, e.g. after a successful sign-in or an explicit
 * dismissal. Notifies subscribers so an open banner hides itself.
 */
export function clearSessionExpiry(): void {
  if (lastEvent === null) return;
  lastEvent = null;
  notify();
}

/** Test-only: drop all listeners and reset state. */
export function resetSessionExpiryForTests(): void {
  listeners.clear();
  lastEvent = null;
}
