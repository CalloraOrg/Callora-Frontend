import { describe, it, expect, beforeEach } from "vitest";
import {
  parseRateLimitHeaders,
  calculateTimeUntilReset,
  shouldUpdateRateLimitState,
  isRateLimitedResponse,
  RateLimitState,
} from "../rate-limit";

describe("parseRateLimitHeaders", () => {
  it("parses valid rate-limit headers with ISO 8601 reset time", () => {
    const resetTime = "2026-08-29T14:30:00Z";
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "45",
        "X-RateLimit-Reset": resetTime,
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result).not.toBeNull();
    expect(result?.limit).toBe(100);
    expect(result?.remaining).toBe(45);
    expect(result?.resetAt).toBeDefined();
    expect(result?.isRateLimited).toBe(false);
  });

  it("parses valid rate-limit headers with Unix timestamp", () => {
    const unixTimestamp = Math.floor(Date.now() / 1000) + 60;
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Limit": "1000",
        "X-RateLimit-Remaining": "100",
        "X-RateLimit-Reset": unixTimestamp.toString(),
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result).not.toBeNull();
    expect(result?.limit).toBe(1000);
    expect(result?.remaining).toBe(100);
    expect(result?.isRateLimited).toBe(false);
  });

  it("marks as rate-limited when remaining is 0", () => {
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "2026-08-29T14:30:00Z",
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result?.isRateLimited).toBe(true);
  });

  it("returns null when limit header is missing", () => {
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Remaining": "45",
        "X-RateLimit-Reset": "2026-08-29T14:30:00Z",
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result).toBeNull();
  });

  it("returns null when remaining header is missing", () => {
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Reset": "2026-08-29T14:30:00Z",
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result).toBeNull();
  });

  it("returns null when both limit and reset are missing", () => {
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Remaining": "45",
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result).toBeNull();
  });

  it("falls back to Retry-After header if X-RateLimit-Reset is missing", () => {
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "Retry-After": "30",
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result).not.toBeNull();
    expect(result?.limit).toBe(100);
    expect(result?.remaining).toBe(0);
    expect(result?.resetAt).toBeDefined();
  });

  it("handles invalid numeric headers gracefully", () => {
    const response = new Response(null, {
      headers: {
        "X-RateLimit-Limit": "invalid",
        "X-RateLimit-Remaining": "45",
        "X-RateLimit-Reset": "2026-08-29T14:30:00Z",
      },
    });

    const result = parseRateLimitHeaders(response);

    expect(result).toBeNull();
  });
});

describe("calculateTimeUntilReset", () => {
  it("returns 0 for a past reset time", () => {
    const pastTime = new Date(Date.now() - 5000).toISOString();
    const result = calculateTimeUntilReset(pastTime);

    expect(result).toBe(0);
  });

  it("returns positive milliseconds for a future reset time", () => {
    const futureTime = new Date(Date.now() + 5000).toISOString();
    const result = calculateTimeUntilReset(futureTime);

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(5000);
  });

  it("returns correct countdown for a specific reset time", () => {
    const fiveSecondsFromNow = Date.now() + 5000;
    const resetTime = new Date(fiveSecondsFromNow).toISOString();
    const result = calculateTimeUntilReset(resetTime);

    // Should be approximately 5000ms (with small variance for test execution time)
    expect(result).toBeGreaterThan(4900);
    expect(result).toBeLessThanOrEqual(5000);
  });
});

describe("shouldUpdateRateLimitState", () => {
  it("returns true when current state is null", () => {
    const newState: RateLimitState = {
      limit: 100,
      remaining: 50,
      resetAt: new Date().toISOString(),
      isRateLimited: false,
    };

    const result = shouldUpdateRateLimitState(null, newState);

    expect(result).toBe(true);
  });

  it("returns false when new state is null and current is not", () => {
    const currentState: RateLimitState = {
      limit: 100,
      remaining: 50,
      resetAt: new Date().toISOString(),
      isRateLimited: false,
    };

    const result = shouldUpdateRateLimitState(currentState, null);

    expect(result).toBe(false);
  });

  it("returns true when new reset time is later than current", () => {
    const now = Date.now();
    const currentState: RateLimitState = {
      limit: 100,
      remaining: 50,
      resetAt: new Date(now + 30000).toISOString(),
      isRateLimited: false,
    };
    const newState: RateLimitState = {
      limit: 100,
      remaining: 10,
      resetAt: new Date(now + 60000).toISOString(),
      isRateLimited: true,
    };

    const result = shouldUpdateRateLimitState(currentState, newState);

    expect(result).toBe(true);
  });

  it("returns false when new reset time is earlier than current", () => {
    const now = Date.now();
    const currentState: RateLimitState = {
      limit: 100,
      remaining: 10,
      resetAt: new Date(now + 60000).toISOString(),
      isRateLimited: true,
    };
    const newState: RateLimitState = {
      limit: 100,
      remaining: 50,
      resetAt: new Date(now + 30000).toISOString(),
      isRateLimited: false,
    };

    const result = shouldUpdateRateLimitState(currentState, newState);

    expect(result).toBe(false);
  });

  it("prefers higher remaining count when reset times are equal", () => {
    const resetTime = new Date().toISOString();
    const currentState: RateLimitState = {
      limit: 100,
      remaining: 30,
      resetAt: resetTime,
      isRateLimited: false,
    };
    const newState: RateLimitState = {
      limit: 100,
      remaining: 50,
      resetAt: resetTime,
      isRateLimited: false,
    };

    const result = shouldUpdateRateLimitState(currentState, newState);

    expect(result).toBe(true);
  });

  it("rejects lower remaining count when reset times are equal", () => {
    const resetTime = new Date().toISOString();
    const currentState: RateLimitState = {
      limit: 100,
      remaining: 50,
      resetAt: resetTime,
      isRateLimited: false,
    };
    const newState: RateLimitState = {
      limit: 100,
      remaining: 30,
      resetAt: resetTime,
      isRateLimited: false,
    };

    const result = shouldUpdateRateLimitState(currentState, newState);

    expect(result).toBe(false);
  });
});

describe("isRateLimitedResponse", () => {
  it("returns true for HTTP 429 status", () => {
    const response = new Response(null, { status: 429 });

    const result = isRateLimitedResponse(response);

    expect(result).toBe(true);
  });

  it("returns false for HTTP 200 status", () => {
    const response = new Response(null, { status: 200 });

    const result = isRateLimitedResponse(response);

    expect(result).toBe(false);
  });

  it("returns false for HTTP 500 status", () => {
    const response = new Response(null, { status: 500 });

    const result = isRateLimitedResponse(response);

    expect(result).toBe(false);
  });

  it("returns false for HTTP 400 status", () => {
    const response = new Response(null, { status: 400 });

    const result = isRateLimitedResponse(response);

    expect(result).toBe(false);
  });
});
