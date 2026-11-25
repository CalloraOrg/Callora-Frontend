import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateTimeUntilReset,
  isRateLimitedResponse,
  parseRateLimitHeaders,
  shouldUpdateRateLimitState,
  type RateLimitState,
} from "./rate-limit";

const NOW = new Date("2026-01-01T00:00:00Z");

function response(
  headers: Record<string, string>,
  status = 200,
): Response {
  return new Response(null, { headers, status });
}

function state(
  resetAt: string,
  remaining: number,
): RateLimitState {
  return {
    limit: 100,
    remaining,
    resetAt,
    isRateLimited: remaining === 0,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("parseRateLimitHeaders", () => {
  it("parses an ISO reset timestamp", () => {
    expect(
      parseRateLimitHeaders(
        response({
          "x-ratelimit-limit": "100",
          "x-ratelimit-remaining": "42",
          "x-ratelimit-reset": "2026-01-01T00:01:00Z",
        }),
      ),
    ).toEqual(state("2026-01-01T00:01:00.000Z", 42));
  });

  it("parses a Unix-seconds reset, including zero", () => {
    expect(
      parseRateLimitHeaders(
        response({
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "42",
          "X-RateLimit-Reset": "0",
        }),
      ),
    ).toEqual(state("1970-01-01T00:00:00.000Z", 42));
  });

  it("returns null for an invalid ISO-looking reset", () => {
    expect(
      parseRateLimitHeaders(
        response({
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "42",
          "X-RateLimit-Reset": "not-a-date",
        }),
      ),
    ).toBeNull();
  });

  it("uses Retry-After seconds relative to the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(
      parseRateLimitHeaders(
        response({
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "Retry-After": "30",
        }),
      ),
    ).toEqual({
      ...state("2026-01-01T00:00:30.000Z", 0),
      isRateLimited: true,
    });
  });

  it("accepts Retry-After zero and HTTP-date values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const headers = {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "5",
    };
    expect(
      parseRateLimitHeaders(response({ ...headers, "Retry-After": "0" }))
        ?.resetAt,
    ).toBe("2026-01-01T00:00:00.000Z");
    expect(
      parseRateLimitHeaders(
        response({
          ...headers,
          "Retry-After": "Thu, 01 Jan 2026 00:01:00 GMT",
        }),
      )?.resetAt,
    ).toBe("2026-01-01T00:01:00.000Z");
  });

  it("returns null when limit or remaining is missing or non-numeric", () => {
    expect(
      parseRateLimitHeaders(
        response({
          "X-RateLimit-Remaining": "5",
          "X-RateLimit-Reset": "2026-01-01T00:01:00Z",
        }),
      ),
    ).toBeNull();
    expect(
      parseRateLimitHeaders(
        response({
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Reset": "2026-01-01T00:01:00Z",
        }),
      ),
    ).toBeNull();

    for (const [limit, remaining] of [
      ["many", "5"],
      ["100", "many"],
    ]) {
      expect(
        parseRateLimitHeaders(
          response({
            "X-RateLimit-Limit": limit,
            "X-RateLimit-Remaining": remaining,
            "X-RateLimit-Reset": "2026-01-01T00:01:00Z",
          }),
        ),
      ).toBeNull();
    }
  });
});

describe("calculateTimeUntilReset", () => {
  it("returns zero when the reset time has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    expect(calculateTimeUntilReset("2025-12-31T23:59:59Z")).toBe(0);
  });
});

describe("shouldUpdateRateLimitState", () => {
  const earlier = state("2026-01-01T00:01:00Z", 10);
  const later = state("2026-01-01T00:02:00Z", 1);

  it("accepts a state when there is no current state", () => {
    expect(shouldUpdateRateLimitState(null, earlier)).toBe(true);
    expect(shouldUpdateRateLimitState(null, null)).toBe(false);
  });

  it("rejects a null or older incoming state", () => {
    expect(shouldUpdateRateLimitState(earlier, null)).toBe(false);
    expect(shouldUpdateRateLimitState(later, earlier)).toBe(false);
  });

  it("accepts a later reset and prefers more remaining on equal resets", () => {
    expect(shouldUpdateRateLimitState(earlier, later)).toBe(true);
    expect(
      shouldUpdateRateLimitState(earlier, state(earlier.resetAt, 11)),
    ).toBe(true);
    expect(
      shouldUpdateRateLimitState(earlier, state(earlier.resetAt, 9)),
    ).toBe(false);
  });
});

describe("isRateLimitedResponse", () => {
  it("returns true only for HTTP 429", () => {
    expect(isRateLimitedResponse(response({}, 429))).toBe(true);
    expect(isRateLimitedResponse(response({}, 200))).toBe(false);
  });
});
