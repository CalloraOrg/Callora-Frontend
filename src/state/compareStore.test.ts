/**
 * compareStore.test.ts
 *
 * Tests for the compareStore external store and useCompareStore hook.
 * Covers: capacity cap (max 3), duplicate rejection, localStorage persistence,
 *         subscriber notification, cross-tab sync via StorageEvent,
 *         listener cleanup on unsubscribe, and UI state toggling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { compareStore, useCompareStore } from "./compareStore";
import type { APIItem } from "../data/mockApis";

const STORAGE_KEY = "callora_compare_state";

const sampleApi1: APIItem = {
  id: "api-1",
  name: "Stellar Horizon API",
  provider: { name: "SDF" },
  description: "Core ledger query API",
  pricePerRequest: 0.001,
};

const sampleApi2: APIItem = {
  id: "api-2",
  name: "Soroban RPC",
  provider: { name: "SDF" },
  description: "Smart contract RPC",
  pricePerRequest: 0.002,
};

const sampleApi3: APIItem = {
  id: "api-3",
  name: "Soroban Oracle API",
  provider: { name: "Reflector" },
  description: "Price feeds for Soroban",
  pricePerRequest: 0.005,
};

const sampleApi4: APIItem = {
  id: "api-4",
  name: "Stellar Anchor Directory",
  provider: { name: "Anchor" },
  description: "Anchor on/off ramps",
  pricePerRequest: 0.003,
};

describe("compareStore", () => {
  beforeEach(() => {
    localStorage.clear();
    compareStore.clear();
  });

  afterEach(() => {
    localStorage.clear();
    compareStore.clear();
  });

  describe("store initialization and basic operations", () => {
    it("starts with an empty apis array and isOpen as false", () => {
      const snapshot = compareStore.getSnapshot();
      expect(snapshot.apis).toEqual([]);
      expect(snapshot.isOpen).toBe(false);
    });

    it("adds an API and returns 'added'", () => {
      const result = compareStore.addApi(sampleApi1);
      expect(result).toBe("added");
      expect(compareStore.getSnapshot().apis).toHaveLength(1);
      expect(compareStore.getSnapshot().apis[0]).toEqual(sampleApi1);
    });

    it("removes an API by ID", () => {
      compareStore.addApi(sampleApi1);
      compareStore.addApi(sampleApi2);
      expect(compareStore.getSnapshot().apis).toHaveLength(2);

      compareStore.removeApi("api-1");
      const current = compareStore.getSnapshot().apis;
      expect(current).toHaveLength(1);
      expect(current[0].id).toBe("api-2");
    });

    it("sets isOpen flag correctly", () => {
      compareStore.setOpen(true);
      expect(compareStore.getSnapshot().isOpen).toBe(true);

      compareStore.setOpen(false);
      expect(compareStore.getSnapshot().isOpen).toBe(false);
    });

    it("clears all APIs and closes drawer on clear()", () => {
      compareStore.addApi(sampleApi1);
      compareStore.setOpen(true);
      expect(compareStore.getSnapshot().apis).toHaveLength(1);
      expect(compareStore.getSnapshot().isOpen).toBe(true);

      compareStore.clear();
      expect(compareStore.getSnapshot().apis).toEqual([]);
      expect(compareStore.getSnapshot().isOpen).toBe(false);
    });
  });

  describe("capacity and duplicate rejection invariants", () => {
    it("rejects duplicates and keeps only one entry", () => {
      const firstResult = compareStore.addApi(sampleApi1);
      expect(firstResult).toBe("added");

      const secondResult = compareStore.addApi(sampleApi1);
      expect(secondResult).toBe("duplicate");

      const snapshot = compareStore.getSnapshot();
      expect(snapshot.apis).toHaveLength(1);
      expect(snapshot.apis[0].id).toBe("api-1");
    });

    it("caps at three APIs and refuses a fourth API", () => {
      expect(compareStore.addApi(sampleApi1)).toBe("added");
      expect(compareStore.addApi(sampleApi2)).toBe("added");
      expect(compareStore.addApi(sampleApi3)).toBe("added");
      expect(compareStore.getSnapshot().apis).toHaveLength(3);

      const fourthResult = compareStore.addApi(sampleApi4);
      expect(fourthResult).toBe("full");

      const snapshot = compareStore.getSnapshot();
      expect(snapshot.apis).toHaveLength(3);
      expect(snapshot.apis.map((a) => a.id)).toEqual(["api-1", "api-2", "api-3"]);
    });
  });

  describe("localStorage persistence", () => {
    it("persists additions to callora_compare_state in localStorage", () => {
      compareStore.addApi(sampleApi1);
      const storedRaw = localStorage.getItem(STORAGE_KEY);
      expect(storedRaw).not.toBeNull();

      const parsed = JSON.parse(storedRaw!);
      expect(parsed.apis).toHaveLength(1);
      expect(parsed.apis[0].id).toBe("api-1");
    });

    it("persists removals to callora_compare_state in localStorage", () => {
      compareStore.addApi(sampleApi1);
      compareStore.addApi(sampleApi2);
      compareStore.removeApi("api-1");

      const storedRaw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(storedRaw!);
      expect(parsed.apis).toHaveLength(1);
      expect(parsed.apis[0].id).toBe("api-2");
    });

    it("persists setOpen changes to localStorage", () => {
      compareStore.setOpen(true);
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed.isOpen).toBe(true);
    });

    it("persists clear() to localStorage", () => {
      compareStore.addApi(sampleApi1);
      compareStore.clear();

      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed.apis).toEqual([]);
      expect(parsed.isOpen).toBe(false);
    });
  });

  describe("subscriber notifications and cross-tab storage events", () => {
    it("notifies subscribers on state mutations", () => {
      const listener = vi.fn();
      const unsubscribe = compareStore.subscribe(listener);

      compareStore.addApi(sampleApi1);
      expect(listener).toHaveBeenCalledTimes(1);

      compareStore.removeApi("api-1");
      expect(listener).toHaveBeenCalledTimes(2);

      compareStore.setOpen(true);
      expect(listener).toHaveBeenCalledTimes(3);

      compareStore.clear();
      expect(listener).toHaveBeenCalledTimes(4);

      unsubscribe();
      compareStore.addApi(sampleApi2);
      expect(listener).toHaveBeenCalledTimes(4); // No further calls after unsubscribe
    });

    it("applies StorageEvent with new state and notifies subscribers", () => {
      const listener = vi.fn();
      const unsubscribe = compareStore.subscribe(listener);

      const crossTabState = {
        apis: [sampleApi2, sampleApi3],
        isOpen: true,
      };

      const storageEvent = new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify(crossTabState),
      });

      window.dispatchEvent(storageEvent);

      expect(listener).toHaveBeenCalledTimes(1);
      const snapshot = compareStore.getSnapshot();
      expect(snapshot.apis).toHaveLength(2);
      expect(snapshot.apis[0].id).toBe("api-2");
      expect(snapshot.apis[1].id).toBe("api-3");
      expect(snapshot.isOpen).toBe(true);

      unsubscribe();
    });

    it("ignores StorageEvent for unrelated keys", () => {
      const listener = vi.fn();
      const unsubscribe = compareStore.subscribe(listener);

      const storageEvent = new StorageEvent("storage", {
        key: "unrelated_storage_key",
        newValue: JSON.stringify({ test: 123 }),
      });

      window.dispatchEvent(storageEvent);

      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    });

    it("unsubscribing removes the storage event listener from window", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const listener = vi.fn();
      const unsubscribe = compareStore.subscribe(listener);

      unsubscribe();

      expect(removeSpy).toHaveBeenCalledWith("storage", expect.any(Function));

      // After unsubscribe, dispatched StorageEvent must not call listener
      const storageEvent = new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: JSON.stringify({ apis: [sampleApi1], isOpen: false }),
      });
      window.dispatchEvent(storageEvent);

      expect(listener).not.toHaveBeenCalled();
      removeSpy.mockRestore();
    });
  });

  describe("useCompareStore React hook", () => {
    it("returns the current snapshot and rerenders when store changes", () => {
      let hookResult: { current: ReturnType<typeof useCompareStore> };
      act(() => {
        const { result } = renderHook(() => useCompareStore());
        hookResult = result;
      });

      expect(hookResult!.current.apis).toEqual([]);
      expect(hookResult!.current.isOpen).toBe(false);

      act(() => {
        compareStore.addApi(sampleApi1);
      });

      expect(hookResult!.current.apis).toHaveLength(1);
      expect(hookResult!.current.apis[0].id).toBe("api-1");

      act(() => {
        compareStore.setOpen(true);
      });

      expect(hookResult!.current.isOpen).toBe(true);
    });
  });
});
