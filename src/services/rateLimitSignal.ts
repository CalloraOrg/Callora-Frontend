/**
 * Rate-limit signal bus.
 *
 * Mirrors `sessionExpiry.ts`: `authFetch` detects HTTP 429 responses at the
 * transport layer and emits a {@link RateLimitEvent} via
 * {@link signalRateLimit}. UI surfaces (such as `ApiUsage` via `useRateLimit`)
 * subscribe through {@link subscribeRateLimit} to render a live countdown and
 * temporarily disable mutating or refresh actions.
 */

export type RateLimitEvent = {
  /** Milliseconds until the rate-limit window resets. */
  retryAfterMs: number;
  /** ISO 8601 timestamp when the rate-limit window resets. */
  resetAt: string;
  /** API path that received the 429 response. */
  path: string;
  /** Maximum requests allowed in the window (from X-RateLimit-Limit), if present. */
  limit?: number;
  /** Remaining requests in the window (from X-RateLimit-Remaining), if present. */
  remaining?: number;
  /** Unix epoch milliseconds when the event was recorded. */
  at: number;
};

export type RateLimitSignalInput = Omit<RateLimitEvent, "at">;

type RateLimitListener = (event: RateLimitEvent) => void;

const listeners = new Set<RateLimitListener>();

/** Last emitted rate-limit event, or null if cleared. */
let lastEvent: RateLimitEvent | null = null;

function notify(event: RateLimitEvent): void {
  // Copy before iterating: a listener may unsubscribe during dispatch.
  for (const listener of Array.from(listeners)) {
    try {
      listener(event);
    } catch {
      // One bad subscriber must not stop the rest from being notified.
    }
  }
}

/**
 * Report that an API request was rate-limited (HTTP 429).
 */
export function signalRateLimit(input: RateLimitSignalInput): void {
  const event: RateLimitEvent = {
    ...input,
    at: Date.now(),
  };
  lastEvent = event;
  notify(event);
}

/**
 * Subscribe to rate-limit events emitted by `authFetch`.
 *
 * @returns An unsubscribe function; safe to call more than once.
 */
export function subscribeRateLimit(listener: RateLimitListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Last emitted rate-limit event, or null if none / cleared. */
export function getLastRateLimitEvent(): RateLimitEvent | null {
  return lastEvent;
}

/** Clear the stored rate-limit event. */
export function clearRateLimitSignal(): void {
  lastEvent = null;
}

/** Test-only: drop all listeners and reset state. */
export function resetRateLimitSignalForTests(): void {
  listeners.clear();
  lastEvent = null;
}
