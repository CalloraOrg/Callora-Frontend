// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { startRouteLoading, stopRouteLoading, useRouteLoading } from "../useRouteLoading";

describe("useRouteLoading", () => {
  it("returns false initially", () => {
    const { result } = renderHook(() => useRouteLoading());
    expect(result.current).toBe(false);
  });

  it("returns true after start is called", () => {
    const { result } = renderHook(() => useRouteLoading());

    act(() => {
      startRouteLoading();
    });

    expect(result.current).toBe(true);
  });

  it("returns false after stop balances start", () => {
    const { result } = renderHook(() => useRouteLoading());

    act(() => {
      startRouteLoading();
    });

    expect(result.current).toBe(true);

    act(() => {
      stopRouteLoading();
    });

    expect(result.current).toBe(false);
  });

  it("tracks concurrent loads", () => {
    const { result } = renderHook(() => useRouteLoading());

    act(() => {
      startRouteLoading();
      startRouteLoading();
    });

    expect(result.current).toBe(true);

    act(() => {
      stopRouteLoading();
    });

    // Still true because one more is active
    expect(result.current).toBe(true);

    act(() => {
      stopRouteLoading();
    });

    expect(result.current).toBe(false);
  });

  it("does not go negative with extra stops", () => {
    const { result } = renderHook(() => useRouteLoading());

    act(() => {
      startRouteLoading();
    });

    expect(result.current).toBe(true);

    act(() => {
      stopRouteLoading();
      stopRouteLoading();
      stopRouteLoading();
    });

    expect(result.current).toBe(false);
  });
});
