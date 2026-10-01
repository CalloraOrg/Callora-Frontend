// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuotaStore } from "./useQuotaStore";
import { QuotaStore, quotaStore } from "../state/quotaStore";
import { makeFakeApi } from "../state/quotaTestUtils";

function record(accountId: string, value: number, version: number) {
  return { accountId, value, version, updatedAt: version };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useQuotaStore", () => {
  it("returns the injected store's snapshot", () => {
    const fake = makeFakeApi();
    const store = new QuotaStore({ api: fake.api, tabId: "hook-test" });

    const { result } = renderHook(() => useQuotaStore(store));

    expect(result.current).toBe(store.getSnapshot());
  });

  it("re-renders with the new snapshot when the store updates", async () => {
    const fake = makeFakeApi();
    const store = new QuotaStore({ api: fake.api, tabId: "hook-test" });
    const { result } = renderHook(() => useQuotaStore(store));

    expect(result.current.currentAccountId).toBe("");

    await act(async () => {
      const pending = store.selectAccount("a");
      fake.resolveFetch(0, record("a", 100, 1));
      await pending;
    });

    expect(result.current).toBe(store.getSnapshot());
    expect(result.current.currentAccountId).toBe("a");
    expect(result.current.slices["a"].value).toBe(100);
    expect(result.current.slices["a"].version).toBe(1);
  });

  it("unsubscribes from the store on unmount", () => {
    const fake = makeFakeApi();
    const store = new QuotaStore({ api: fake.api, tabId: "hook-test" });

    const unsubscribes: ReturnType<typeof vi.fn>[] = [];
    const subscribe = store.subscribe;
    vi.spyOn(store, "subscribe").mockImplementation((listener) => {
      const unsubscribe = subscribe(listener);
      const wrapped = vi.fn(() => unsubscribe());
      unsubscribes.push(wrapped);
      return wrapped;
    });

    const { unmount } = renderHook(() => useQuotaStore(store));
    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribes).toHaveLength(1);

    unmount();

    expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
  });

  it("uses the shared singleton when no store is passed", () => {
    const before = quotaStore.getSnapshot();
    const { result } = renderHook(() => useQuotaStore());

    expect(result.current).toBe(quotaStore.getSnapshot());
    expect(quotaStore.getSnapshot()).toBe(before);
  });
});
