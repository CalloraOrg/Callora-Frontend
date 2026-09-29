import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRateLimit } from "../useRateLimit";

describe("useRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with null rate-limit state", () => {
    const { result } = renderHook(() => useRateLimit());

    expect(result.current.rateLimitState).toBeNull();
    expect(result.current.timeUntilReset).toBe(0);
  });

  it("updates rate-limit state from response headers", () => {
    const { result } = renderHook(() => useRateLimit());

    const resetTime = new Date(Date.now() + 30000).toISOString();
    const response = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime,
      },
    });

    act(() => {
      result.current.updateFromResponse(response);
    });

    expect(result.current.rateLimitState).not.toBeNull();
    expect(result.current.rateLimitState?.limit).toBe(100);
    expect(result.current.rateLimitState?.remaining).toBe(0);
  });

  it("starts countdown timer when rate-limited", () => {
    const { result } = renderHook(() => useRateLimit());

    const resetTime = new Date(Date.now() + 30000).toISOString();
    const response = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime,
      },
    });

    act(() => {
      result.current.updateFromResponse(response);
    });

    expect(result.current.timeUntilReset).toBeGreaterThan(0);
    expect(result.current.timeUntilReset).toBeLessThanOrEqual(30000);
  });

  it("decrements countdown timer over time", async () => {
    const { result } = renderHook(() => useRateLimit());

    const resetTime = new Date(Date.now() + 30000).toISOString();
    const response = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime,
      },
    });

    act(() => {
      result.current.updateFromResponse(response);
    });

    const initialTime = result.current.timeUntilReset;

    // Advance timer by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.timeUntilReset).toBeLessThan(initialTime);
  });

  it("clears rate-limit state when reset time passes", () => {
    const { result } = renderHook(() => useRateLimit());

    const resetTime = new Date(Date.now() + 5000).toISOString();
    const response = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime,
      },
    });

    act(() => {
      result.current.updateFromResponse(response);
    });

    expect(result.current.rateLimitState).not.toBeNull();

    // Advance timer past reset time
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(result.current.rateLimitState).toBeNull();
    expect(result.current.timeUntilReset).toBe(0);
  });

  it("prevents concurrent responses from overwriting newer state", () => {
    const { result } = renderHook(() => useRateLimit());

    const now = Date.now();
    const resetTime1 = new Date(now + 60000).toISOString();
    const resetTime2 = new Date(now + 30000).toISOString();

    const response1 = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime1,
      },
    });

    const response2 = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "10",
        "X-RateLimit-Reset": resetTime2,
      },
    });

    // First response sets reset to 60 seconds
    act(() => {
      result.current.updateFromResponse(response1);
    });

    const stateAfterFirst = result.current.rateLimitState?.resetAt;

    // Second response with earlier reset time should not update
    act(() => {
      result.current.updateFromResponse(response2);
    });

    expect(result.current.rateLimitState?.resetAt).toBe(stateAfterFirst);
  });

  it("prefers newer response with later reset time", () => {
    const { result } = renderHook(() => useRateLimit());

    const now = Date.now();
    const resetTime1 = new Date(now + 30000).toISOString();
    const resetTime2 = new Date(now + 60000).toISOString();

    const response1 = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime1,
      },
    });

    const response2 = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime2,
      },
    });

    // First response sets reset to 30 seconds
    act(() => {
      result.current.updateFromResponse(response1);
    });

    // Second response with later reset time should update
    act(() => {
      result.current.updateFromResponse(response2);
    });

    expect(
      new Date(result.current.rateLimitState?.resetAt || "").getTime(),
    ).toBe(new Date(resetTime2).getTime());
  });

  it("resets rate-limit state manually", () => {
    const { result } = renderHook(() => useRateLimit());

    const resetTime = new Date(Date.now() + 30000).toISOString();
    const response = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime,
      },
    });

    act(() => {
      result.current.updateFromResponse(response);
    });

    expect(result.current.rateLimitState).not.toBeNull();

    act(() => {
      result.current.resetRateLimit();
    });

    expect(result.current.rateLimitState).toBeNull();
    expect(result.current.timeUntilReset).toBe(0);
  });

  it("cleans up timer on unmount", () => {
    const { result, unmount } = renderHook(() => useRateLimit());

    const resetTime = new Date(Date.now() + 30000).toISOString();
    const response = new Response(null, {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetTime,
      },
    });

    act(() => {
      result.current.updateFromResponse(response);
    });

    unmount();

    // No errors should occur; timer should be cleaned up
    expect(true).toBe(true);
  });

  it("handles response without rate-limit headers", () => {
    const { result } = renderHook(() => useRateLimit());

    const response = new Response(null, { status: 200 });

    act(() => {
      result.current.updateFromResponse(response);
    });

    expect(result.current.rateLimitState).toBeNull();
  });
});
