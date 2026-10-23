/**
 * pinnedApis.test.ts
 *
 * Tests for the pinnedApisStore external store and usePinnedApis hook.
 * Covers: pin, unpin, toggle, isPinned, localStorage persistence,
 *         duplicate pin guard, idempotent unpin, and _reset helper.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { pinnedApisStore, usePinnedApis } from "./pinnedApis";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "callora_pinned_apis";

function storedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  pinnedApisStore._reset();
});

afterEach(() => {
  localStorage.clear();
  pinnedApisStore._reset();
});

// ─── Store unit tests ─────────────────────────────────────────────────────────

describe("pinnedApisStore", () => {
  it("starts empty", () => {
    expect(pinnedApisStore.getSnapshot().size).toBe(0);
  });

  it("pin adds an API id", () => {
    pinnedApisStore.pin("api-1");
    expect(pinnedApisStore.isPinned("api-1")).toBe(true);
  });

  it("pin is idempotent (duplicate ignored)", () => {
    pinnedApisStore.pin("api-1");
    pinnedApisStore.pin("api-1");
    expect(pinnedApisStore.getSnapshot().size).toBe(1);
  });

  it("unpin removes an API id", () => {
    pinnedApisStore.pin("api-1");
    pinnedApisStore.unpin("api-1");
    expect(pinnedApisStore.isPinned("api-1")).toBe(false);
  });

  it("unpin is idempotent when id is not pinned", () => {
    expect(() => pinnedApisStore.unpin("not-pinned")).not.toThrow();
    expect(pinnedApisStore.getSnapshot().size).toBe(0);
  });

  it("toggle pins an unpinned API", () => {
    pinnedApisStore.toggle("api-2");
    expect(pinnedApisStore.isPinned("api-2")).toBe(true);
  });

  it("toggle unpins a pinned API", () => {
    pinnedApisStore.pin("api-2");
    pinnedApisStore.toggle("api-2");
    expect(pinnedApisStore.isPinned("api-2")).toBe(false);
  });

  it("isPinned returns false for unknown id", () => {
    expect(pinnedApisStore.isPinned("unknown")).toBe(false);
  });

  it("multiple ids can be pinned independently", () => {
    pinnedApisStore.pin("api-1");
    pinnedApisStore.pin("api-2");
    expect(pinnedApisStore.isPinned("api-1")).toBe(true);
    expect(pinnedApisStore.isPinned("api-2")).toBe(true);
    pinnedApisStore.unpin("api-1");
    expect(pinnedApisStore.isPinned("api-1")).toBe(false);
    expect(pinnedApisStore.isPinned("api-2")).toBe(true);
  });
});

// ─── localStorage persistence ─────────────────────────────────────────────────

describe("localStorage persistence", () => {
  it("pin persists to localStorage", () => {
    pinnedApisStore.pin("api-1");
    expect(storedIds()).toContain("api-1");
  });

  it("unpin removes from localStorage", () => {
    pinnedApisStore.pin("api-1");
    pinnedApisStore.unpin("api-1");
    expect(storedIds()).not.toContain("api-1");
  });

  it("toggle persists updated state", () => {
    pinnedApisStore.toggle("api-3");
    expect(storedIds()).toContain("api-3");
    pinnedApisStore.toggle("api-3");
    expect(storedIds()).not.toContain("api-3");
  });

  it("gracefully handles corrupt localStorage", () => {
    // Simulate corrupt data by directly writing invalid JSON — the store
    // ignores it on next initialisation and stays functional at runtime.
    localStorage.setItem(STORAGE_KEY, "{not-valid-json}");
    // The live store is already initialised; just ensure operations don't throw.
    expect(() => pinnedApisStore.pin("api-safe")).not.toThrow();
    expect(pinnedApisStore.isPinned("api-safe")).toBe(true);
  });
});

// ─── usePinnedApis hook ───────────────────────────────────────────────────────

describe("usePinnedApis hook", () => {
  it("returns empty Set initially", () => {
    const { result } = renderHook(() => usePinnedApis());
    expect(result.current.size).toBe(0);
  });

  it("reflects pin action", () => {
    const { result } = renderHook(() => usePinnedApis());
    act(() => { pinnedApisStore.pin("api-hook"); });
    expect(result.current.has("api-hook")).toBe(true);
  });

  it("reflects unpin action", () => {
    const { result } = renderHook(() => usePinnedApis());
    act(() => { pinnedApisStore.pin("api-hook"); });
    act(() => { pinnedApisStore.unpin("api-hook"); });
    expect(result.current.has("api-hook")).toBe(false);
  });

  it("reflects toggle action", () => {
    const { result } = renderHook(() => usePinnedApis());
    act(() => { pinnedApisStore.toggle("api-toggle"); });
    expect(result.current.has("api-toggle")).toBe(true);
    act(() => { pinnedApisStore.toggle("api-toggle"); });
    expect(result.current.has("api-toggle")).toBe(false);
  });

  it("notifies all subscribers", () => {
    const cb = vi.fn();
    const unsub = pinnedApisStore.subscribe(cb);
    pinnedApisStore.pin("api-sub");
    expect(cb).toHaveBeenCalledTimes(1);
    pinnedApisStore.unpin("api-sub");
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    pinnedApisStore.pin("api-sub");
    expect(cb).toHaveBeenCalledTimes(2); // no more calls after unsub
  });
});
