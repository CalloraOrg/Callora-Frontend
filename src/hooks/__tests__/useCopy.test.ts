// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useCopy from "../useCopy";

describe("useCopy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns copied false initially", () => {
    const { result } = renderHook(() => useCopy());
    expect(result.current.copied).toBe(false);
  });

  it("calls navigator.clipboard.writeText on handleCopy", async () => {
    const { result } = renderHook(() => useCopy());
    await act(async () => {
      await result.current.handleCopy("hello world");
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello world");
  });

  it("sets copied to true after successful copy", async () => {
    const { result } = renderHook(() => useCopy());
    await act(async () => {
      await result.current.handleCopy("text");
    });
    expect(result.current.copied).toBe(true);
  });

  it("resets copied to false after 2 seconds", async () => {
    const { result } = renderHook(() => useCopy());
    await act(async () => {
      await result.current.handleCopy("text");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });

  it("falls back to textarea/execCommand when clipboard API is unavailable", async () => {
    // @ts-expect-error — testing fallback path
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // jsdom does not implement execCommand; define it for the fallback path
    const execCommandSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommandSpy,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCopy());
    await act(async () => {
      await result.current.handleCopy("fallback text");
    });

    expect(execCommandSpy).toHaveBeenCalledWith("copy");
    expect(result.current.copied).toBe(true);
  });

  it("clears timer on unmount", async () => {
    const { result, unmount } = renderHook(() => useCopy());
    await act(async () => {
      await result.current.handleCopy("text");
    });
    unmount();
    // Should not throw after unmount
    act(() => {
      vi.advanceTimersByTime(2000);
    });
  });

  it("resets previous timer on rapid consecutive copies", async () => {
    const { result } = renderHook(() => useCopy());
    await act(async () => {
      await result.current.handleCopy("first");
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      await result.current.handleCopy("second");
    });
    expect(result.current.copied).toBe(true);

    // Still true at the 1s mark from the second copy
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.copied).toBe(true);

    // Now the 2s from second copy elapses
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.copied).toBe(false);
  });
});
