import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApisByIds } from "./useApisByIds";
import * as catalogApi from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";

const makeApi = (id: string, name: string): APIItem => ({
  id,
  name,
  description: `${name} description`,
  provider: { name: "Acme" },
  pricePerRequest: 0.01,
});

describe("useApisByIds", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ready immediately with empty arrays for an empty id list", () => {
    const spy = vi.spyOn(catalogApi, "resolveApisByIds");
    const { result } = renderHook(() => useApisByIds([]));

    expect(result.current.status).toBe("ready");
    expect(result.current.apis).toEqual([]);
    expect(result.current.missing).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("resolves APIs in input order and reports missing ids", async () => {
    const apiB = makeApi("b", "Beta API");
    const apiA = makeApi("a", "Alpha API");

    vi.spyOn(catalogApi, "resolveApisByIds").mockResolvedValue({
      apis: [apiB, apiA],
      missing: ["gone-1"],
    });

    const { result } = renderHook(() => useApisByIds(["b", "gone-1", "a"]));

    expect(result.current.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.apis.map((a) => a.id)).toEqual(["b", "a"]);
    expect(result.current.missing).toEqual(["gone-1"]);
    expect(result.current.error).toBeNull();
  });

  it("deduplicates duplicate ids and does not re-fetch on re-render with equivalent ids", async () => {
    const apiA = makeApi("a", "Alpha API");
    const spy = vi.spyOn(catalogApi, "resolveApisByIds").mockResolvedValue({
      apis: [apiA],
      missing: [],
    });

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useApisByIds(ids),
      { initialProps: { ids: ["a", "a"] } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(["a"], expect.any(AbortSignal));

    // Re-render with a new array reference containing the same deduplicated ids
    rerender({ ids: ["a"] });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("transitions to error state when the resolver rejects", async () => {
    vi.spyOn(catalogApi, "resolveApisByIds").mockRejectedValue(
      new Error("Backend unreachable"),
    );

    const { result } = renderHook(() => useApisByIds(["a"]));

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.apis).toEqual([]);
    expect(result.current.missing).toEqual([]);
    expect(result.current.error).toBe("Backend unreachable");
  });
});
