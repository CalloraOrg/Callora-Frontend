// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiHealth } from "./useApiHealth";
import * as catalogApi from "../api/catalogApi";

describe("useApiHealth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads health data and transitions from loading to ready", async () => {
    const spy = vi
      .spyOn(catalogApi, "fetchApiHealth")
      .mockResolvedValue(["operational", "degraded"]);

    const { result } = renderHook(() => useApiHealth("api-1"));

    expect(result.current.loading).toBe(true);
    expect(result.current.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(["operational", "degraded"]);
    expect(spy).toHaveBeenCalledWith("api-1", expect.any(AbortSignal));
  });

  it("handles errors and retries on demand", async () => {
    const spy = vi
      .spyOn(catalogApi, "fetchApiHealth")
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValueOnce(["operational"]);

    const { result } = renderHook(() => useApiHealth("api-err"));

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.error).toBe("Service unavailable");
    expect(result.current.data).toEqual([]);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.data).toEqual(["operational"]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("aborts the previous request when id changes", async () => {
    const signals: AbortSignal[] = [];
    vi.spyOn(catalogApi, "fetchApiHealth").mockImplementation(
      (_id, signal) => {
        if (signal) signals.push(signal);
        return new Promise((resolve) => {
          setTimeout(() => resolve(["operational"]), 50);
        });
      },
    );

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useApiHealth(id),
      { initialProps: { id: "api-1" } },
    );

    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    rerender({ id: "api-2" });

    expect(signals[0].aborted).toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);
  });

  it("stays idle without fetching when disabled or id is missing", () => {
    const spy = vi.spyOn(catalogApi, "fetchApiHealth");

    const { result } = renderHook(() => useApiHealth("api-1", false));
    expect(result.current.status).toBe("idle");
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
