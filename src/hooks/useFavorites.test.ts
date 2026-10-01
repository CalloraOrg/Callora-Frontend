// @vitest-environment jsdom

/**
 * Membership + persistence behaviour of `useFavorites`.
 *
 * `MarketplacePage`'s favourites-only filter is driven entirely by this hook,
 * so a broken toggle silently empties the filtered list. The hook persists to
 * the `callora.favorites` localStorage key through `useLocalStorage`, which is
 * asserted directly here (not just through hook state).
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFavorites } from "./useFavorites";

const STORAGE_KEY = "callora.favorites";

function storedFavorites(): unknown {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

describe("useFavorites", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("starts with an empty list when nothing is persisted", () => {
    const { result } = renderHook(() => useFavorites());

    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite("api-1")).toBe(false);
  });

  it("adds an absent id when toggled", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.toggleFavorite("api-1");
    });

    expect(result.current.favorites).toEqual(["api-1"]);
    expect(result.current.isFavorite("api-1")).toBe(true);
  });

  it("removes a present id when toggled again", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.toggleFavorite("api-1");
    });
    act(() => {
      result.current.toggleFavorite("api-1");
    });

    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite("api-1")).toBe(false);
  });

  it("persists the list as JSON under callora.favorites", () => {
    const { result } = renderHook(() => useFavorites());

    act(() => {
      result.current.toggleFavorite("api-1");
    });
    act(() => {
      result.current.toggleFavorite("api-2");
    });

    expect(storedFavorites()).toEqual(["api-1", "api-2"]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('["api-1","api-2"]');
  });

  it("hydrates from a previously persisted list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["api-9"]));

    const { result } = renderHook(() => useFavorites());

    expect(result.current.favorites).toEqual(["api-9"]);
    expect(result.current.isFavorite("api-9")).toBe(true);
    expect(result.current.isFavorite("api-1")).toBe(false);
  });

  it("keeps unrelated ids when one entry is toggled off", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["api-1", "api-2", "api-3"]));

    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite("api-2")).toBe(true);

    act(() => {
      result.current.toggleFavorite("api-2");
    });

    expect(result.current.favorites).toEqual(["api-1", "api-3"]);
    expect(storedFavorites()).toEqual(["api-1", "api-3"]);
  });

  it("falls back to an empty list when the stored value is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "not valid json");

    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
  });

  it("does not throw when localStorage throws", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError: storage is full");
    });

    const { result } = renderHook(() => useFavorites());

    expect(() => {
      act(() => {
        result.current.toggleFavorite("api-1");
      });
    }).not.toThrow();

    // In-memory state still updates so the UI stays responsive.
    expect(result.current.isFavorite("api-1")).toBe(true);
  });
});
