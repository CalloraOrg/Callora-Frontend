// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionExpiry,
  signalExpiry,
} from "../services/sessionExpiry";
import { useSessionExpiry } from "./useSessionExpiry";

afterEach(() => {
  cleanup();
  clearSessionExpiry();
});

describe("useSessionExpiry", () => {
  it("starts with a valid session", () => {
    const { result } = renderHook(() => useSessionExpiry());

    expect(result.current).toMatchObject({
      event: null,
      isExpired: false,
      reason: undefined,
    });
  });

  it("reports an unauthorized expiry event", () => {
    const { result } = renderHook(() => useSessionExpiry());

    act(() => {
      signalExpiry("unauthorized");
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.reason).toBe("unauthorized");
    expect(result.current.event).toMatchObject({ reason: "unauthorized" });
  });

  it("dismisses an expiry and is a no-op while valid", () => {
    const { result } = renderHook(() => useSessionExpiry());

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isExpired).toBe(false);

    act(() => {
      signalExpiry("unauthorized");
      result.current.dismiss();
    });
    expect(result.current.isExpired).toBe(false);
    expect(result.current.event).toBeNull();
  });

  it("updates every active subscriber together", () => {
    const first = renderHook(() => useSessionExpiry());
    const second = renderHook(() => useSessionExpiry());

    act(() => {
      signalExpiry("unauthorized");
    });

    expect(first.result.current.isExpired).toBe(true);
    expect(second.result.current).toMatchObject({
      isExpired: true,
      reason: "unauthorized",
    });
  });

  it("unsubscribes on unmount", () => {
    const changes = vi.fn();
    const observer = renderHook(() => {
      const state = useSessionExpiry();
      changes(state.isExpired);
      return state;
    });

    expect(changes).toHaveBeenCalledTimes(1);
    observer.unmount();

    act(() => {
      signalExpiry("unauthorized");
    });

    expect(changes).toHaveBeenCalledTimes(1);
  });
});
