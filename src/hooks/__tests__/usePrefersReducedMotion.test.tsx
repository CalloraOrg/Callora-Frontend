// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REDUCED_MOTION_QUERY,
  usePrefersReducedMotion,
} from "../usePrefersReducedMotion";

type ChangeListener = (event: { matches: boolean; media: string }) => void;

/** Controllable MediaQueryList mock so preference changes can be simulated. */
function createMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<ChangeListener>();

  const mql = {
    get matches() {
      return matches;
    },
    media: REDUCED_MOTION_QUERY,
    onchange: null as null | ChangeListener,
    addListener: (cb: ChangeListener) => listeners.add(cb),
    removeListener: (cb: ChangeListener) => listeners.delete(cb),
    addEventListener: (_type: string, cb: ChangeListener) => listeners.add(cb),
    removeEventListener: (_type: string, cb: ChangeListener) =>
      listeners.delete(cb),
    dispatchEvent: () => false,
  };

  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    if (query === REDUCED_MOTION_QUERY) return mql;
    return { ...mql, media: query, matches: false };
  });

  return {
    mql,
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((cb) =>
        cb({ matches: next, media: REDUCED_MOTION_QUERY }),
      );
    },
  };
}

describe("usePrefersReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns false when reduced motion is not preferred", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when the user prefers reduced motion", () => {
    createMatchMediaMock(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reactively flips as the OS preference changes", () => {
    const mock = createMatchMediaMock(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => mock.setMatches(true));
    expect(result.current).toBe(true);

    act(() => mock.setMatches(false));
    expect(result.current).toBe(false);
  });

  it("stops listening after unmount", () => {
    const mock = createMatchMediaMock(false);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    unmount();

    // Mutating matches after unmount must not throw.
    act(() => mock.setMatches(true));
    expect(result.current).toBe(false);
  });

  it("falls back to the legacy addListener API when addEventListener is missing", () => {
    const listeners = new Set<ChangeListener>();
    let matches = false;
    const mql = {
      get matches() {
        return matches;
      },
      media: REDUCED_MOTION_QUERY,
      addListener: (cb: ChangeListener) => listeners.add(cb),
      removeListener: (cb: ChangeListener) => listeners.delete(cb),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql);

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      listeners.forEach((cb) =>
        cb({ matches: true, media: REDUCED_MOTION_QUERY }),
      );
    });
    expect(result.current).toBe(true);
  });

  it("returns false (SSR-safe) when matchMedia is unavailable", () => {
    (window as any).matchMedia = undefined;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});