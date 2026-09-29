import { useCallback, useEffect, useRef, useState } from "react";
import {
  BalancesRequestError,
  fetchAccountBalances,
  type AccountBalances,
} from "../api/balances";

/**
 * Lifecycle of an account-scoped balance request.
 *
 * - `loading` — a request is in flight; balances are unknown.
 * - `ready`   — balances were returned and `balances` is non-null.
 * - `error`   — the request failed; balances are unknown, never zero.
 */
export type BalancesStatus = "loading" | "ready" | "error";

export interface UseBalancesResult {
  /** Vault/wallet balances, or `null` while unknown. */
  balances: AccountBalances | null;
  status: BalancesStatus;
  /** Human-readable failure reason, or `null` when there is none. */
  error: string | null;
  /** Re-run the request for the current account. */
  refresh: () => void;
}

function toMessage(error: unknown): string {
  if (error instanceof BalancesRequestError) return error.message;
  if (error instanceof Error && error.message.length > 0) return error.message;
  return "Balances could not be loaded.";
}

/**
 * An abort means the request was superseded (account switch, unmount, newer
 * refresh), not that it failed. Some runtimes reject with an `AbortError`
 * without the signal reporting `aborted`, so both signals are checked.
 */
function isAbort(error: unknown, signal: AbortSignal): boolean {
  // `instanceof Error` is unreliable here: DOMException does not inherit from
  // Error in every runtime (jsdom included), so the name is read structurally.
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return signal.aborted || name === "AbortError";
}

/**
 * Loads the vault and wallet balances of an account.
 *
 * Invariants:
 * - `balances !== null` **iff** `status === "ready"`. A failed request leaves
 *   the balance unknown so the UI can never present a fabricated `0.00`.
 * - Changing `accountId` starts a new request and drops the previous account's
 *   balances, so switching accounts can never show stale numbers.
 * - In-flight requests are aborted on account switch and on unmount, and their
 *   results are discarded, so a slow response cannot overwrite the balances of
 *   the account the user is now looking at.
 *
 * @param accountId - Account whose balances should be loaded.
 */
export function useBalances(accountId: string): UseBalancesResult {
  const [balances, setBalances] = useState<AccountBalances | null>(null);
  const [status, setStatus] = useState<BalancesStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Monotonic id of the newest request; anything older is stale on arrival.
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    const controller = new AbortController();

    // Unknown until this request settles — never a leftover or a default 0.
    setBalances(null);
    setStatus("loading");
    setError(null);

    fetchAccountBalances(accountId, { signal: controller.signal })
      .then((nextBalances) => {
        if (latestRequestRef.current !== requestId) return;
        setBalances(nextBalances);
        setError(null);
        setStatus("ready");
      })
      .catch((requestError: unknown) => {
        if (latestRequestRef.current !== requestId) return;
        if (isAbort(requestError, controller.signal)) return;
        setBalances(null);
        setError(toMessage(requestError));
        setStatus("error");
      });

    return () => controller.abort();
  }, [accountId, reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { balances, status, error, refresh };
}

export default useBalances;
