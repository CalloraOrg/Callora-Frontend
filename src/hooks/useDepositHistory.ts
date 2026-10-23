import { useCallback, useEffect, useState } from "react";
import { useWalletStore } from "../state/walletStore";
import { fetchDepositEvents } from "../services/vaultEvents";
import type { BillingTransaction } from "../pages/BillingHistory";

export type DepositHistoryStatus = "no-wallet" | "loading" | "error" | "empty" | "ready";

export type DepositHistory = {
  status: DepositHistoryStatus;
  transactions: BillingTransaction[];
  retentionTruncated: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  retry: () => void;
  loadOlder: () => void;
};

type Loaded = {
  address: string;
  transactions: BillingTransaction[];
  nextCursor: string | null;
  retentionTruncated: boolean;
  error: string | null;
};

const GENERIC_ERROR = "Could not load deposit history. Try again.";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_ERROR;
}

function mergeById(existing: BillingTransaction[], incoming: BillingTransaction[]): BillingTransaction[] {
  const seen = new Set(existing.map((tx) => tx.id));
  return [...existing, ...incoming.filter((tx) => !seen.has(tx.id))];
}

/**
 * Deposit history for the connected wallet, read from the vault's deposit
 * events. Results are tagged with the address they were fetched for, so a
 * response that arrives after the wallet changed is discarded and never
 * mixes rows from two addresses.
 */
export function useDepositHistory(): DepositHistory {
  const { address } = useWalletStore();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    setLoaded(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    fetchDepositEvents({ address, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setLoaded({
          address,
          transactions: page.transactions,
          nextCursor: page.nextCursor,
          retentionTruncated: page.retentionTruncated,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({ address, transactions: [], nextCursor: null, retentionTruncated: false, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [address, reloadKey]);

  const current = loaded && loaded.address === address ? loaded : null;

  const loadOlder = useCallback(() => {
    if (!address || !current?.nextCursor || loadingMore) return;
    const cursor = current.nextCursor;
    setLoadingMore(true);
    setLoadMoreError(null);
    fetchDepositEvents({ address, cursor })
      .then((page) => {
        setLoaded((prev) => {
          if (!prev || prev.address !== address) return prev;
          return {
            ...prev,
            transactions: mergeById(prev.transactions, page.transactions),
            nextCursor: page.nextCursor,
            retentionTruncated: prev.retentionTruncated || page.retentionTruncated,
          };
        });
      })
      .catch((error: unknown) => {
        setLoadMoreError(errorMessage(error));
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [address, current, loadingMore]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  let status: DepositHistoryStatus;
  if (!address) status = "no-wallet";
  else if (!current) status = "loading";
  else if (current.error) status = "error";
  else if (current.transactions.length === 0) status = "empty";
  else status = "ready";

  return {
    status,
    transactions: current?.transactions ?? [],
    retentionTruncated: current?.retentionTruncated ?? false,
    error: current?.error ?? null,
    hasMore: current?.nextCursor != null,
    loadingMore,
    loadMoreError,
    retry,
    loadOlder,
  };
}
