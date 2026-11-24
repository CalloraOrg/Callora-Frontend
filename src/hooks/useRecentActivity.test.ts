// @vitest-environment jsdom
/**
 * Behaviour of `useRecentActivity` (issue #1409).
 *
 * The hook feeds the dashboard's Recent Activity list, so a stale response or
 * a retry that silently does nothing leaves the user looking at the wrong
 * account's data. Requests are driven by deferred promises so ordering is
 * deterministic and no real timers or network are involved.
 */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentActivity } from "./useRecentActivity";

type PendingRequest = {
  url: string;
  signal: AbortSignal | undefined;
  resolve: (response: Response) => void;
  reject: (reason?: unknown) => void;
};

let pending: PendingRequest[] = [];

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function errorResponse(status = 500, body: unknown = { message: "boom" }): Response {
  return { ok: false, status, json: async () => body } as unknown as Response;
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx-1",
    type: "Deposit",
    amount: 12.5,
    timestamp: "2026-11-20T10:00:00.000Z",
    description: "vault deposit",
    status: "success",
    ...overrides,
  };
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

beforeEach(() => {
  pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      return new Promise<Response>((resolve, reject) => {
        pending.push({ url, signal: init?.signal ?? undefined, resolve, reject });
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useRecentActivity", () => {
  it("maps transactions into activity items and statuses", async () => {
    const { result } = renderHook(() => useRecentActivity("account-1"));

    expect(result.current.status).toBe("loading");

    await act(async () => {
      pending[0]!.resolve(
        jsonResponse([
          transaction({ id: "a", type: "Deposit", status: "success" }),
          transaction({ id: "b", type: "Usage", status: "error" }),
          transaction({ id: "c", type: "Usage", status: "pending" }),
          transaction({ id: "d", type: "Usage", status: "warning" }),
        ]),
      );
    });

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.error).toBeNull();
    expect(result.current.items.map((item) => item.type)).toEqual([
      "deposit",
      "usage",
      "usage",
      "usage",
    ]);
    expect(result.current.items.map((item) => item.status)).toEqual([
      "success",
      "error",
      "operational",
      "operational",
    ]);
    expect(result.current.items[0]).toMatchObject({
      id: "a",
      amount: 12.5,
      date: "2026-11-20T10:00:00.000Z",
      endpoint: "vault deposit",
    });
  });

  it("requests the account id and activity limit", async () => {
    renderHook(() => useRecentActivity("account-1"));

    expect(pending[0]!.url).toContain("accountId=account-1");
    expect(pending[0]!.url).toContain("limit=10");
  });

  it("surfaces an HTTP error as status 'error'", async () => {
    const { result } = renderHook(() => useRecentActivity("account-1"));

    await act(async () => {
      pending[0]!.resolve(errorResponse(500, { message: "activity exploded" }));
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("activity exploded");
    expect(result.current.items).toEqual([]);
  });

  it("does not fetch and reports success when no account is selected", () => {
    const { result } = renderHook(() => useRecentActivity(null));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("success");
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("aborts the in-flight request on unmount", () => {
    const { unmount } = renderHook(() => useRecentActivity("account-1"));
    const signal = pending[0]!.signal;

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("ignores an AbortError from the superseded request", async () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) => useRecentActivity(accountId),
      { initialProps: { accountId: "account-1" } },
    );

    rerender({ accountId: "account-2" });

    await act(async () => {
      pending[0]!.reject(abortError());
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.error).toBeNull();
  });

  it("aborts the previous request and refetches when the account changes", async () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) => useRecentActivity(accountId),
      { initialProps: { accountId: "account-1" } },
    );

    rerender({ accountId: "account-2" });

    expect(pending).toHaveLength(2);
    expect(pending[0]!.signal?.aborted).toBe(true);
    expect(pending[1]!.url).toContain("accountId=account-2");

    await act(async () => {
      pending[1]!.resolve(
        jsonResponse([transaction({ id: "new", description: "account 2" })]),
      );
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.items.map((item) => item.id)).toEqual(["new"]);
  });

  it("discards a stale response that arrives after a newer one", async () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) => useRecentActivity(accountId),
      { initialProps: { accountId: "account-1" } },
    );

    rerender({ accountId: "account-2" });

    await act(async () => {
      pending[1]!.resolve(jsonResponse([transaction({ id: "fresh" })]));
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    await act(async () => {
      pending[0]!.resolve(jsonResponse([transaction({ id: "stale" })]));
    });

    expect(result.current.items.map((item) => item.id)).toEqual(["fresh"]);
  });

  it("retries after every error, not just the first", async () => {
    const { result } = renderHook(() => useRecentActivity("account-1"));

    await act(async () => {
      pending[0]!.resolve(errorResponse(500, { message: "first failure" }));
    });
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());
    expect(pending).toHaveLength(2);
    await act(async () => {
      pending[1]!.resolve(errorResponse(503, { message: "second failure" }));
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("second failure");

    act(() => result.current.retry());
    expect(pending).toHaveLength(3);

    await act(async () => {
      pending[2]!.resolve(jsonResponse([transaction({ id: "recovered" })]));
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.items.map((item) => item.id)).toEqual(["recovered"]);
    expect(result.current.error).toBeNull();
  });
});
