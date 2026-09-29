import { useState, useEffect, useCallback, useRef } from "react";
import {
  RateLimitState,
  parseRateLimitHeaders,
  calculateTimeUntilReset,
  shouldUpdateRateLimitState,
  isRateLimitedResponse,
} from "../utils/rate-limit";

/**
 * useRateLimit: Manages rate-limit state and countdown timer.
 *
 * Handles:
 *   - Parsing rate-limit headers from responses
 *   - Maintaining authoritative state (newer responses always win)
 *   - Auto-updating countdown timer every second
 *   - Cleaning up timers on unmount
 *   - Preventing concurrent/out-of-order requests from overwriting state
 *
 * Usage:
 *   const { rateLimitState, updateFromResponse, resetRateLimit, timeUntilReset } = useRateLimit();
 *
 *   // After an API call:
 *   if (response.status === 429) {
 *     updateFromResponse(response);
 *   }
 */
export function useRateLimit() {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState | null>(
    null,
  );
  const [timeUntilReset, setTimeUntilReset] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update rate-limit state from a fetch Response.
   * Only updates if the new state is "newer" (later resetAt or higher remaining).
   */
  const updateFromResponse = useCallback((response: Response) => {
    const newState = parseRateLimitHeaders(response);

    setRateLimitState((current) => {
      if (shouldUpdateRateLimitState(current, newState)) {
        return newState;
      }
      return current;
    });

    // If this is a 429, the state should already be rate-limited
    if (isRateLimitedResponse(response)) {
      // Ensure state is marked as rate-limited
      setRateLimitState((current) => {
        if (newState && !newState.isRateLimited) {
          return { ...newState, isRateLimited: true };
        }
        return current;
      });
    }
  }, []);

  /**
   * Manually clear rate-limit state (e.g., on successful response).
   */
  const resetRateLimit = useCallback(() => {
    setRateLimitState(null);
    setTimeUntilReset(0);
  }, []);

  /**
   * Update countdown timer every second.
   */
  useEffect(() => {
    if (!rateLimitState) {
      setTimeUntilReset(0);
      return;
    }

    // Calculate initial value
    const initial = calculateTimeUntilReset(rateLimitState.resetAt);
    setTimeUntilReset(Math.max(0, initial));

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Set up interval to update every second
    timerRef.current = setInterval(() => {
      const remaining = calculateTimeUntilReset(rateLimitState.resetAt);

      if (remaining <= 0) {
        // Reset time has passed; clear state
        setRateLimitState(null);
        setTimeUntilReset(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        setTimeUntilReset(remaining);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rateLimitState]);

  return {
    /** Current rate-limit state, or null if not rate-limited. */
    rateLimitState,
    /** Milliseconds until rate-limit resets (0 if not rate-limited). */
    timeUntilReset,
    /** Update state from a fetch Response. */
    updateFromResponse,
    /** Manually clear rate-limit state. */
    resetRateLimit,
  };
}
