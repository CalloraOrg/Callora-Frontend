// @vitest-environment jsdom

/**
 * Dedicated coverage for the `useQuota` 24-hour dismissal window.
 *
 * `PlanNudge` hides itself while a dismissal is fresh (24 h), and `useQuota`
 * removes the timestamp once the window expires. An off-by-one or a parse
 * failure silently either nags forever or hides the upgrade prompt forever, so
 * each branch is pinned here.
 *
 * Only `Date` is faked (`toFake: ['Date']`) — that keeps `vi.setSystemTime`
 * usable without interfering with React's scheduling.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuota } from "./useQuota";

const DISMISS_KEY = "callora-plan-nudge-dismissed-at";
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-03-01T12:00:00.000Z").getTime();

describe("useQuota", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("reports the usage percentage it was given", () => {
    const { result } = renderHook(() => useQuota(87));
    expect(result.current.usagePercent).toBe(87);
  });

  it("is not dismissed when nothing is stored", () => {
    const { result } = renderHook(() => useQuota(90));
    expect(result.current.isDismissed).toBe(false);
  });

  it("dismiss() sets isDismissed and stores the current timestamp", () => {
    const { result } = renderHook(() => useQuota(90));

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isDismissed).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBe(String(NOW));
  });

  it("stays dismissed for a timestamp stored just under 24 hours ago", () => {
    localStorage.setItem(DISMISS_KEY, String(NOW - DAY_MS + 1));

    const { result } = renderHook(() => useQuota(90));

    expect(result.current.isDismissed).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBe(String(NOW - DAY_MS + 1));
  });

  it("clears the entry and reports not dismissed once 24 h + 1 ms have passed", () => {
    localStorage.setItem(DISMISS_KEY, String(NOW - DAY_MS - 1));

    const { result } = renderHook(() => useQuota(90));

    expect(result.current.isDismissed).toBe(false);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("treats a timestamp exactly on the 24-hour boundary as expired", () => {
    localStorage.setItem(DISMISS_KEY, String(NOW - DAY_MS));

    const { result } = renderHook(() => useQuota(90));

    expect(result.current.isDismissed).toBe(false);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("treats a non-numeric stored value as not dismissed and removes it", () => {
    localStorage.setItem(DISMISS_KEY, "not-a-timestamp");

    const { result } = renderHook(() => useQuota(90));

    expect(result.current.isDismissed).toBe(false);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("treats an empty stored value as not dismissed", () => {
    localStorage.setItem(DISMISS_KEY, "");

    const { result } = renderHook(() => useQuota(90));

    expect(result.current.isDismissed).toBe(false);
  });

  it("does not throw when localStorage reads throw", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: access to localStorage is denied");
    });

    const { result } = renderHook(() => useQuota(90));

    expect(result.current.isDismissed).toBe(false);
  });

  it("does not throw when localStorage writes throw while dismissing", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError: storage is full");
    });

    const { result } = renderHook(() => useQuota(90));

    expect(() => {
      act(() => {
        result.current.dismiss();
      });
    }).not.toThrow();

    // Session-only dismissal still applies even though persistence failed.
    expect(result.current.isDismissed).toBe(true);
  });

  it("does not throw when localStorage.removeItem throws on expiry", () => {
    localStorage.setItem(DISMISS_KEY, String(NOW - DAY_MS - 1));
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError: access to localStorage is denied");
    });

    const { result } = renderHook(() => useQuota(90));

    expect(result.current.isDismissed).toBe(false);
  });
});
