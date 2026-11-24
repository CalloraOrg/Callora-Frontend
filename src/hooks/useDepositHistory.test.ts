// @vitest-environment jsdom
/**
 * Behaviour of `useDepositHistory` (issue #1409).
 *
 * The hook drives the deposit history list from the wallet's vault events. The
 * cases that matter are the status machine, dropping rows fetched for a wallet
 * that is no longer connected, cursor pagination without duplicates, and
 * retry. `fetchDepositEvents` is mocked so responses can be resolved out of
 * order without touching the network.
 */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const freighterMocks = vi.hoisted(() => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  isAllowed: vi.fn(),
  isConnected: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  getAddress: freighterMocks.getAddress,
  getNetworkDetails: freighterMocks.getNetworkDetails,
  isAllowed: freighterMocks.isAllowed,
  isConnected: freighterMocks.isConnected,
  WatchWalletChanges: class {
    watch() {
      return {};
    }
    stop() {}
  },
}));

const vaultMocks = vi.hoisted(() => ({ fetchDepositEvents: vi.fn() }));

vi.mock("../services/vaultEvents", () => ({
  fetchDepositEvents: vaultMocks.fetchDepositEvents,
}));

import { useDepositHistory } from "./useDepositHistory";
import { walletStore } from "../state/walletStore";
import type { DepositHistoryPage } from "../services/vaultEvents";
import type { BillingTransaction } from "../pages/BillingHistory";

const ADDRESS_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const ADDRESS_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function transaction(id: string): BillingTransaction {
  return {
    id,
    description: "USDC vault deposit",
    type: "Deposit",
    direction: "credit",
    amount: 10,
    status: "success",
    timestamp: "2026-11-20T10:00:00.000Z",
    txHash: id.padEnd(64, "0"),
    network: "Stellar Testnet",
    confirmations: 1,
  };
}

function page(
  transactions: BillingTransaction[],
  overrides: Partial<DepositHistoryPage> = {},
): DepositHistoryPage {
  return {
    transactions,
    nextCursor: null,
    retentionTruncated: false,
    ...overrides,
  };
}

async function connect(address: string) {
  freighterMocks.isConnected.mockResolvedValue({ isConnected: true });
  freighterMocks.isAllowed.mockResolvedValue({ isAllowed: true });
  freighterMocks.getAddress.mockResolvedValue({ address });
  freighterMocks.getNetworkDetails.mockResolvedValue({
    network: "TESTNET",
    networkPassphrase: "Test SDF Network ; September 2015",
  });
  await act(async () => {
    await walletStore.refresh();
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  freighterMocks.isConnected.mockResolvedValue({ isConnected: false });
  await act(async () => {
    await walletStore.refresh();
  });
});

afterEach(() => {
  cleanup();
});

describe("useDepositHistory", () => {
  it("reports 'no-wallet' and does not fetch when no wallet is connected", () => {
    const { result } = renderHook(() => useDepositHistory());

    expect(result.current.status).toBe("no-wallet");
    expect(result.current.transactions).toEqual([]);
    expect(vaultMocks.fetchDepositEvents).not.toHaveBeenCalled();
  });

  it("is 'loading' while the first page is in flight", async () => {
    await connect(ADDRESS_A);
    const request = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents.mockReturnValue(request.promise);

    const { result } = renderHook(() => useDepositHistory());

    expect(result.current.status).toBe("loading");
    expect(vaultMocks.fetchDepositEvents).toHaveBeenCalledWith(
      expect.objectContaining({ address: ADDRESS_A, signal: expect.any(AbortSignal) }),
    );
  });

  it("is 'ready' with rows and exposes the next cursor", async () => {
    await connect(ADDRESS_A);
    const request = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents.mockReturnValue(request.promise);

    const { result } = renderHook(() => useDepositHistory());

    await act(async () => {
      request.resolve(page([transaction("tx-1")], { nextCursor: "cursor-2" }));
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.transactions.map((tx) => tx.id)).toEqual(["tx-1"]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("is 'empty' when the page has no rows", async () => {
    await connect(ADDRESS_A);
    const request = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents.mockReturnValue(request.promise);

    const { result } = renderHook(() => useDepositHistory());

    await act(async () => {
      request.resolve(page([]));
    });

    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(result.current.hasMore).toBe(false);
  });

  it("is 'error' when the page rejects", async () => {
    await connect(ADDRESS_A);
    const request = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents.mockReturnValue(request.promise);

    const { result } = renderHook(() => useDepositHistory());

    await act(async () => {
      request.reject(new Error("rpc unavailable"));
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("rpc unavailable");
    expect(result.current.transactions).toEqual([]);
  });

  it("drops rows fetched for a wallet that is no longer connected", async () => {
    await connect(ADDRESS_A);
    const first = deferred<DepositHistoryPage>();
    const second = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useDepositHistory());

    await connect(ADDRESS_B);

    await act(async () => {
      second.resolve(page([transaction("wallet-b")]));
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      first.resolve(page([transaction("wallet-a")]));
    });

    expect(result.current.transactions.map((tx) => tx.id)).toEqual(["wallet-b"]);
  });

  it("refetches on retry after an error", async () => {
    await connect(ADDRESS_A);
    const first = deferred<DepositHistoryPage>();
    const second = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useDepositHistory());

    await act(async () => {
      first.reject(new Error("timeout"));
    });
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());
    expect(vaultMocks.fetchDepositEvents).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve(page([transaction("recovered")]));
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.transactions.map((tx) => tx.id)).toEqual(["recovered"]);
    expect(result.current.error).toBeNull();
  });

  it("merges older pages without duplicating rows", async () => {
    await connect(ADDRESS_A);
    const first = deferred<DepositHistoryPage>();
    const older = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(older.promise);

    const { result } = renderHook(() => useDepositHistory());

    await act(async () => {
      first.resolve(page([transaction("tx-1"), transaction("tx-2")], { nextCursor: "cursor-2" }));
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.loadOlder());
    expect(vaultMocks.fetchDepositEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ address: ADDRESS_A, cursor: "cursor-2" }),
    );
    expect(result.current.loadingMore).toBe(true);

    await act(async () => {
      older.resolve(page([transaction("tx-2"), transaction("tx-3")]));
    });

    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.transactions.map((tx) => tx.id)).toEqual([
      "tx-1",
      "tx-2",
      "tx-3",
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it("keeps the loaded rows and exposes loadMoreError when the next page fails", async () => {
    await connect(ADDRESS_A);
    const first = deferred<DepositHistoryPage>();
    const older = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(older.promise);

    const { result } = renderHook(() => useDepositHistory());

    await act(async () => {
      first.resolve(page([transaction("tx-1")], { nextCursor: "cursor-2" }));
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.loadOlder());
    await act(async () => {
      older.reject(new Error("page failed"));
    });

    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.loadMoreError).toBe("page failed");
    expect(result.current.transactions.map((tx) => tx.id)).toEqual(["tx-1"]);
    expect(result.current.status).toBe("ready");
  });

  it("keeps retentionTruncated sticky across older pages", async () => {
    await connect(ADDRESS_A);
    const first = deferred<DepositHistoryPage>();
    const older = deferred<DepositHistoryPage>();
    vaultMocks.fetchDepositEvents
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(older.promise);

    const { result } = renderHook(() => useDepositHistory());

    await act(async () => {
      first.resolve(
        page([transaction("tx-1")], {
          nextCursor: "cursor-2",
          retentionTruncated: true,
        }),
      );
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.retentionTruncated).toBe(true);

    act(() => result.current.loadOlder());
    await act(async () => {
      older.resolve(page([transaction("tx-2")], { retentionTruncated: false }));
    });

    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.retentionTruncated).toBe(true);
  });
});
