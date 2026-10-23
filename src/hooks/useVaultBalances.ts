import { useCallback, useEffect, useRef, useState } from "react";
import {
  isVaultReadConfigured,
  readVaultBalance,
  readWalletUsdcBalance,
} from "../services/vaultReads";

/**
 * Lifecycle of the on-chain balance reads.
 *
 * - `idle`   — nothing has been requested yet.
 * - `loading`— a read is in flight and no value is available to show.
 * - `ready`  — the most recent read succeeded (`updatedAt` marks which one).
 * - `error`  — the most recent read failed; `error` explains why.
 */
export type BalanceReadStatus = "idle" | "loading" | "ready" | "error";

/** Alias kept for readability at the call sites that predate the split. */
export type VaultBalanceStatus = BalanceReadStatus;

export interface VaultBalances {
  /** Vault balance in stroops, or null while unknown. */
  vault: bigint | null;
  /** Wallet USDC balance in stroops; null until a Freighter address is known. */
  wallet: bigint | null;
  status: BalanceReadStatus;
  /** Human-readable reason for the most recent failure, if any. */
  error: string | null;
  /** False when no vault contract is configured; no read can run. */
  configured: boolean;
  /** Re-read both balances. Resolves once the (debounced) read settles. */
  refresh: () => Promise<void>;
  /** Epoch ms of the last successful read, or null. */
  updatedAt: number | null;
  /** Increments on every successful read; use to detect fresh values. */
  revision: number;
}

export interface UseVaultBalancesOptions {
  /** Connected Freighter address. The wallet read only runs once this is known. */
  address?: string;
}

interface BalanceState {
  vault: bigint | null;
  wallet: bigint | null;
  status: VaultBalanceStatus;
  error: string | null;
  updatedAt: number | null;
  revision: number;
}

const INITIAL_STATE: BalanceState = {
  vault: null,
  wallet: null,
  status: "idle",
  error: null,
  updatedAt: null,
  revision: 0,
};

/**
 * Coalesce bursts of `refresh()` calls (for example when the deposit modal is
 * opened and closed) so the RPC sees at most one read per window.
 */
export const BALANCE_REFRESH_DEBOUNCE_MS = 300;

function errorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "string" && reason) return reason;
  return "Could not read the on-chain balance.";
}

/**
 * Read the Callora vault and connected-wallet USDC balances from Stellar via
 * read-only Soroban simulation.
 *
 * Values are stroops (`i128`, 7 decimals); format them with
 * `formatUsdcStroops` rather than converting through `Number`. Both balances
 * share one status so a single Retry recovers the surface, and superseded
 * responses are ignored so an older read can never overwrite a newer one.
 */
export function useVaultBalances(
  options: UseVaultBalancesOptions = {},
): VaultBalances {
  const address = options.address;
  const configured = isVaultReadConfigured();
  const [state, setState] = useState<BalanceState>(INITIAL_STATE);

  const versionRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressRef = useRef<string | undefined>(address);
  const mountedRef = useRef(true);
  const refreshResolversRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const flushRefreshResolvers = useCallback(() => {
    const resolvers = refreshResolversRef.current;
    refreshResolversRef.current = [];
    for (const resolve of resolvers) resolve();
  }, []);

  const load = useCallback(async () => {
    if (!isVaultReadConfigured()) {
      flushRefreshResolvers();
      return;
    }
    // A read is already running: queue exactly one follow-up with the latest
    // address instead of stacking another RPC round-trip.
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    inFlightRef.current = true;
    const version = ++versionRef.current;
    setState((prev) => ({
      ...prev,
      // Keep showing known values while a refresh re-reads them; only show
      // skeletons when there is nothing to display yet.
      status: prev.vault === null && prev.wallet === null ? "loading" : prev.status,
      error: null,
    }));

    try {
      const knownAddress = addressRef.current;
      const [vaultResult, walletResult] = await Promise.allSettled([
        readVaultBalance(knownAddress),
        knownAddress ? readWalletUsdcBalance(knownAddress) : Promise.resolve(null),
      ]);
      if (version !== versionRef.current) return; // superseded: ignore

      const failures: string[] = [];
      let vault: bigint | null = null;
      let wallet: bigint | null = null;

      if (vaultResult.status === "fulfilled") {
        vault = vaultResult.value;
      } else {
        failures.push(errorMessage(vaultResult.reason));
      }

      if (walletResult.status === "rejected") {
        failures.push(errorMessage(walletResult.reason));
      } else if (walletResult.value !== null) {
        wallet = walletResult.value;
      }

      setState((prev) => ({
        vault,
        wallet,
        status: failures.length > 0 ? "error" : "ready",
        error: failures.length > 0 ? failures[0] : null,
        updatedAt: failures.length > 0 ? prev.updatedAt : Date.now(),
        revision: failures.length > 0 ? prev.revision : prev.revision + 1,
      }));
    } catch (error) {
      if (version !== versionRef.current) return;
      setState((prev) => ({
        ...prev,
        vault: null,
        wallet: null,
        status: "error",
        error: errorMessage(error),
      }));
    } finally {
      inFlightRef.current = false;
      // Run a queued follow-up even when this response was superseded (for
      // example the address became known mid-read), but never after unmount.
      const runQueued = queuedRef.current && mountedRef.current;
      queuedRef.current = false;
      if (runQueued) {
        await loadRef.current();
        return;
      }
      flushRefreshResolvers();
    }
  }, [flushRefreshResolvers]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  // Initial load, and a reload once a Freighter address becomes known so the
  // wallet balance can be read. Cleanup invalidates in-flight responses.
  useEffect(() => {
    if (!configured) return undefined;
    void loadRef.current();
    return () => {
      versionRef.current += 1;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [configured, address]);

  useEffect(
    () => () => {
      flushRefreshResolvers();
    },
    [flushRefreshResolvers],
  );

  const refresh = useCallback((): Promise<void> => {
    if (!isVaultReadConfigured()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      refreshResolversRef.current.push(resolve);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void load();
      }, BALANCE_REFRESH_DEBOUNCE_MS);
    });
  }, [load]);

  return {
    vault: state.vault,
    wallet: state.wallet,
    status: state.status,
    error: state.error,
    configured,
    refresh,
    updatedAt: state.updatedAt,
    revision: state.revision,
  };
}
