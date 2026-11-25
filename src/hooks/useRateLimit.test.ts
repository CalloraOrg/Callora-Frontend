// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitSignalForTests } from "../services/rateLimitSignal";
import { useRateLimit } from "./useRateLimit";

const NOW = new Date("2026-01-01T00:00:00Z");

function response(resetAt: string, remaining = "5", status = 200): Response {
  return new Response(null, {
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": remaining,
      "X-RateLimit-Reset": resetAt,
    },
    status,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  resetRateLimitSignalForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRateLimit", () => {
  it("decrements the countdown and clears state when the reset arrives", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      result.current.updateFromResponse(
        response("2026-01-01T00:00:03Z"),
      );
    });
    expect(result.current.timeUntilReset).toBe(3000);
    expect(result.current.rateLimitState?.remaining).toBe(5);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.timeUntilReset).toBe(2000);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.timeUntilReset).toBe(0);
    expect(result.current.rateLimitState).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not let an older response overwrite a newer reset", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      result.current.updateFromResponse(
        response("2026-01-01T00:00:30Z", "4"),
      );
      result.current.updateFromResponse(
        response("2026-01-01T00:00:20Z", "1"),
      );
    });

    expect(result.current.rateLimitState?.resetAt).toBe(
      "2026-01-01T00:00:30.000Z",
    );
    expect(result.current.rateLimitState?.remaining).toBe(4);
  });

  it("marks a 429 response as rate-limited", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      result.current.updateFromResponse(
        response("2026-01-01T00:00:30Z", "5", 429),
      );
    });

    expect(result.current.rateLimitState?.isRateLimited).toBe(true);
  });

  it("resetRateLimit clears the state and countdown", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      result.current.updateFromResponse(
        response("2026-01-01T00:00:30Z"),
      );
    });
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      result.current.resetRateLimit();
    });

    expect(result.current.rateLimitState).toBeNull();
    expect(result.current.timeUntilReset).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up its interval and does not update after unmount", () => {
    const onRender = vi.fn();
    const { result, unmount } = renderHook(() => {
      onRender();
      return useRateLimit();
    });

    act(() => {
      result.current.updateFromResponse(
        response("2026-01-01T00:00:30Z"),
      );
    });
    const renderCount = onRender.mock.calls.length;
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onRender).toHaveBeenCalledTimes(renderCount);
  });
});
