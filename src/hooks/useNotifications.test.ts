// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "./useNotifications";
import {
  NotificationsApiError,
  type NotificationItem,
} from "../api/notificationsApi";

const mockFetchNotifications = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock("../api/notificationsApi", async () => {
  const actual = await vi.importActual<typeof import("../api/notificationsApi")>(
    "../api/notificationsApi",
  );
  return {
    ...actual,
    fetchNotifications: (...args: unknown[]) => mockFetchNotifications(...args),
    markRead: (...args: unknown[]) => mockMarkRead(...args),
    markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
  };
});

const item1: NotificationItem = {
  id: "n1",
  title: "First notification",
  body: "Body 1",
  createdAt: "2026-11-22T10:00:00.000Z",
  readAt: null,
  kind: "usage",
};

const item2: NotificationItem = {
  id: "n2",
  title: "Second notification",
  body: "Body 2",
  createdAt: "2026-11-22T09:00:00.000Z",
  readAt: null,
  kind: "billing",
};

const item3: NotificationItem = {
  id: "n3",
  title: "Older notification",
  body: "Body 3",
  createdAt: "2026-11-20T09:00:00.000Z",
  readAt: "2026-11-20T10:00:00.000Z",
  kind: "system",
};

describe("useNotifications", () => {
  beforeEach(() => {
    mockFetchNotifications.mockReset();
    mockMarkRead.mockReset();
    mockMarkAllRead.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fetch when signed out (enabled: false)", () => {
    const { result } = renderHook(() => useNotifications({ enabled: false }));

    expect(mockFetchNotifications).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.status).toBe("idle");
  });

  it("loads first page and supports cursor pagination", async () => {
    mockFetchNotifications
      .mockResolvedValueOnce({ items: [item1, item2], nextCursor: "page-2" })
      .mockResolvedValueOnce({ items: [item3], nextCursor: null });

    const { result } = renderHook(() =>
      useNotifications({ enabled: true, pollIntervalMs: 0 }),
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "page-2" }),
    );
    expect(result.current.items).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it("optimistically marks an item read and rolls back on failure", async () => {
    mockFetchNotifications.mockResolvedValueOnce({
      items: [item1, item2],
      nextCursor: null,
    });

    let rejectMarkRead!: (err: Error) => void;
    mockMarkRead.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectMarkRead = reject;
        }),
    );

    const onActionError = vi.fn();
    const { result } = renderHook(() =>
      useNotifications({ enabled: true, pollIntervalMs: 0, onActionError }),
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    let markPromise!: Promise<boolean>;
    act(() => {
      markPromise = result.current.markAsRead("n1");
    });

    // Immediately updated optimistically
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items[0].readAt).not.toBeNull();

    // Reject request -> should roll back
    await act(async () => {
      rejectMarkRead(new Error("Network error"));
      const ok = await markPromise;
      expect(ok).toBe(false);
    });

    expect(result.current.unreadCount).toBe(2);
    expect(result.current.items[0].readAt).toBeNull();
    expect(onActionError).toHaveBeenCalledWith("Network error");
  });

  it("polls while tab is visible and pauses when hidden", async () => {
    vi.useFakeTimers();
    mockFetchNotifications.mockResolvedValue({
      items: [item1],
      nextCursor: null,
    });

    renderHook(() =>
      useNotifications({ enabled: true, pollIntervalMs: 60_000 }),
    );

    // Flush initial fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);

    // Advance 60s while visible -> triggers poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockFetchNotifications).toHaveBeenCalledTimes(2);

    // Hide tab -> no more polling
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(mockFetchNotifications).toHaveBeenCalledTimes(2);
  });

  it("clears feed and stops polling on 401 mid-session", async () => {
    vi.useFakeTimers();
    mockFetchNotifications
      .mockResolvedValueOnce({ items: [item1], nextCursor: null })
      .mockRejectedValueOnce(new NotificationsApiError("Unauthorized", 401));

    const { result } = renderHook(() =>
      useNotifications({ enabled: true, pollIntervalMs: 60_000 }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.items).toHaveLength(1);

    // Next poll returns 401
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isSignedIn).toBe(false);

    // Further timer ticks should not poll again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(mockFetchNotifications).toHaveBeenCalledTimes(2);
  });
});
