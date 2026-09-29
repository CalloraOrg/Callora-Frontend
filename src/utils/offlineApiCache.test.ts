import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getCache, setCache, invalidateAccountCache, isCacheEntryValid } from "./offlineApiCache";

const ACCOUNT_A = "account-1";
const ACCOUNT_B = "account-2";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("offlineApiCache", () => {
  it("returns null when no cache entry exists", () => {
    expect(getCache(ACCOUNT_A, "key-1")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    setCache(ACCOUNT_A, "key-1", { value: 42 });
    expect(getCache(ACCOUNT_A, "key-1")).toEqual({ value: 42 });
  });

  it("returns null for expired entries", () => {
    vi.useFakeTimers();
    setCache(ACCOUNT_A, "key-1", { value: 42 }, 1);
    vi.advanceTimersByTime(2);
    expect(getCache(ACCOUNT_A, "key-1")).toBeNull();
    vi.useRealTimers();
  });

  it("scopes cache entries by account id", () => {
    setCache(ACCOUNT_A, "key-1", { value: "a" });
    setCache(ACCOUNT_B, "key-1", { value: "b" });
    expect(getCache(ACCOUNT_A, "key-1")).toEqual({ value: "a" });
    expect(getCache(ACCOUNT_B, "key-1")).toEqual({ value: "b" });
  });

  it("invalidates all entries for an account", () => {
    setCache(ACCOUNT_A, "key-1", { value: 1 });
    setCache(ACCOUNT_A, "key-2", { value: 2 });
    setCache(ACCOUNT_B, "key-3", { value: 3 });
    invalidateAccountCache(ACCOUNT_A);
    expect(getCache(ACCOUNT_A, "key-1")).toBeNull();
    expect(getCache(ACCOUNT_A, "key-2")).toBeNull();
    expect(getCache(ACCOUNT_B, "key-3")).toEqual({ value: 3 });
  });

  it("invalidate is idempotent (duplicate call does not throw)", () => {
    setCache(ACCOUNT_A, "key-1", { value: 1 });
    invalidateAccountCache(ACCOUNT_A);
    invalidateAccountCache(ACCOUNT_A);
    expect(getCache(ACCOUNT_A, "key-1")).toBeNull();
  });

  it("reports validity correctly", () => {
    setCache(ACCOUNT_A, "key-1", { value: 1 });
    expect(isCacheEntryValid(ACCOUNT_A, "key-1")).toBe(true);
    invalidateAccountCache(ACCOUNT_A);
    expect(isCacheEntryValid(ACCOUNT_A, "key-1")).toBe(false);
  });

  it("handles concurrent invalidations safely", () => {
    setCache(ACCOUNT_A, "key-1", { value: 1 });
    setCache(ACCOUNT_A, "key-2", { value: 2 });
    invalidateAccountCache(ACCOUNT_A);
    invalidateAccountCache(ACCOUNT_A);
    invalidateAccountCache(ACCOUNT_A);
    expect(getCache(ACCOUNT_A, "key-1")).toBeNull();
    expect(getCache(ACCOUNT_A, "key-2")).toBeNull();
  });

  it("recovers when localStorage throws during set", () => {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = vi.fn(() => {
      throw new Error("storage full");
    });
    expect(() => setCache(ACCOUNT_A, "key-1", { value: 1 })).not.toThrow();
    localStorage.setItem = originalSetItem;
  });

  it("recovers when localStorage throws during invalidate", () => {
    setCache(ACCOUNT_A, "key-1", { value: 1 });
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = vi.fn(() => {
      throw new Error("storage error");
    });
    expect(() => invalidateAccountCache(ACCOUNT_A)).not.toThrow();
    localStorage.removeItem = originalRemoveItem;
  });
});
