// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FetchTrackerProvider,
  useFetchTracker,
} from "../useFetchTracker";

describe("useFetchTracker", () => {
  it("returns isFetching false initially", () => {
    const { result } = renderHook(() => useFetchTracker(), {
      wrapper: FetchTrackerProvider,
    });
    expect(result.current.isFetching).toBe(false);
  });

  it("returns isFetching true during tracked promise", async () => {
    const { result } = renderHook(() => useFetchTracker(), {
      wrapper: FetchTrackerProvider,
    });

    let resolvePromise!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    await act(async () => {
      result.current.trackFetch(promise);
    });

    expect(result.current.isFetching).toBe(true);

    await act(async () => {
      resolvePromise();
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
  });

  it("handles multiple concurrent fetches", async () => {
    const { result } = renderHook(() => useFetchTracker(), {
      wrapper: FetchTrackerProvider,
    });

    const deferred1 = deferredPromise();
    const deferred2 = deferredPromise();

    await act(async () => {
      result.current.trackFetch(deferred1.promise);
    });
    await act(async () => {
      result.current.trackFetch(deferred2.promise);
    });

    expect(result.current.isFetching).toBe(true);

    await act(async () => {
      deferred1.resolve();
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });

    await act(async () => {
      deferred2.resolve();
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
  });

  it("recovers from rejected promises", async () => {
    const { result } = renderHook(() => useFetchTracker(), {
      wrapper: FetchTrackerProvider,
    });

    const deferred = deferredPromise<string>();

    await act(async () => {
      result.current.trackFetch(deferred.promise).catch(() => {});
    });

    expect(result.current.isFetching).toBe(true);

    await act(async () => {
      deferred.reject(new Error("fetch failed"));
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
  });

  it("returns the promise result", async () => {
    const { result } = renderHook(() => useFetchTracker(), {
      wrapper: FetchTrackerProvider,
    });

    let resolvePromise!: (v: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    let output = "";
    await act(async () => {
      result.current.trackFetch(promise).then((v) => {
        output = v;
      });
    });

    await act(async () => {
      resolvePromise("hello");
    });

    await waitFor(() => {
      expect(output).toBe("hello");
    });
  });
});

function deferredPromise<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
