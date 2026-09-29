/**
 * Rate-limit header parsing and state management utilities.
 *
 * Extracts authoritative rate-limit information from HTTP response headers
 * following standard conventions:
 *   - X-RateLimit-Limit: maximum requests per window
 *   - X-RateLimit-Remaining: remaining requests in current window
 *   - X-RateLimit-Reset: UTC timestamp (ISO 8601 or Unix seconds) when limit resets
 *   - Retry-After: seconds to wait before retrying (alternative to X-RateLimit-Reset)
 */

/**
 * Rate-limit state extracted from response headers.
 */
export type RateLimitState = {
  /** Maximum requests allowed in this rate-limit window. */
  limit: number;
  /** Remaining requests available before hitting the limit. */
  remaining: number;
  /** ISO 8601 timestamp when the rate-limit window resets. */
  resetAt: string;
  /** Whether the client is currently rate-limited (remaining === 0). */
  isRateLimited: boolean;
};

/**
 * Parses rate-limit headers from a fetch Response object.
 *
 * @param response - The fetch Response object
 * @returns RateLimitState if headers are present, null otherwise
 *
 * Handles multiple reset formats:
 *   - "2026-08-29T14:30:00Z" (ISO 8601)
 *   - "1725190200" (Unix timestamp in seconds)
 *   - Retry-After as fallback (in seconds)
 *
 * If any header is missing or invalid, returns null (not rate-limited).
 */
export function parseRateLimitHeaders(
  response: Response,
): RateLimitState | null {
  const limit = response.headers.get("X-RateLimit-Limit");
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const reset = response.headers.get("X-RateLimit-Reset");
  const retryAfter = response.headers.get("Retry-After");

  if (!limit || !remaining) {
    return null;
  }

  const limitNum = parseInt(limit, 10);
  const remainingNum = parseInt(remaining, 10);

  if (isNaN(limitNum) || isNaN(remainingNum)) {
    return null;
  }

  let resetAt: string;

  if (reset) {
    // Try parsing as ISO 8601 first
    if (reset.includes("T") || reset.includes("-")) {
      resetAt = new Date(reset).toISOString();
    } else {
      // Assume Unix timestamp in seconds; convert to milliseconds
      const timestamp = parseInt(reset, 10);
      if (isNaN(timestamp)) {
        return null;
      }
      resetAt = new Date(timestamp * 1000).toISOString();
    }
  } else if (retryAfter) {
    // Retry-After can be seconds or HTTP-date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      resetAt = new Date(Date.now() + seconds * 1000).toISOString();
    } else {
      // Try parsing as HTTP-date
      const date = new Date(retryAfter);
      if (isNaN(date.getTime())) {
        return null;
      }
      resetAt = date.toISOString();
    }
  } else {
    return null;
  }

  return {
    limit: limitNum,
    remaining: remainingNum,
    resetAt,
    isRateLimited: remainingNum === 0,
  };
}

/**
 * Calculates milliseconds until the rate-limit resets.
 *
 * @param resetAt - ISO 8601 timestamp when reset occurs
 * @returns Milliseconds until reset (0 or negative if already reset)
 */
export function calculateTimeUntilReset(resetAt: string): number {
  const resetDate = new Date(resetAt);
  const now = Date.now();
  const msUntilReset = resetDate.getTime() - now;
  return Math.max(0, msUntilReset);
}

/**
 * Determines if a newer rate-limit state should replace an older one.
 *
 * Prevents concurrent/out-of-order responses from overwriting newer state.
 * Newer resetAt timestamp always wins; if equal, prefer higher remaining count.
 *
 * @param currentState - The currently stored rate-limit state
 * @param newState - The incoming rate-limit state from a response
 * @returns true if newState should replace currentState, false otherwise
 */
export function shouldUpdateRateLimitState(
  currentState: RateLimitState | null,
  newState: RateLimitState | null,
): boolean {
  if (!currentState) {
    return newState !== null;
  }
  if (!newState) {
    return false;
  }

  const currentReset = new Date(currentState.resetAt).getTime();
  const newReset = new Date(newState.resetAt).getTime();

  // Newer reset time always wins (handles race conditions)
  if (newReset !== currentReset) {
    return newReset > currentReset;
  }

  // If reset times are equal, prefer higher remaining count
  return newState.remaining > currentState.remaining;
}

/**
 * Checks if a response indicates rate-limiting (HTTP 429).
 *
 * @param response - The fetch Response object
 * @returns true if status is 429, false otherwise
 */
export function isRateLimitedResponse(response: Response): boolean {
  return response.status === 429;
}
