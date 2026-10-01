import { createContext, createElement, useCallback, useContext, useMemo, type ReactNode } from "react";
import { usePersistedState } from "./usePersistedState";

/**
 * Account selection.
 *
 * The frontend can act on behalf of more than one Callora account, so every
 * account-scoped resource (balances today, more later) is keyed by the active
 * account id. Switching accounts must therefore invalidate anything already
 * loaded for the previous account.
 *
 * The context has a usable default value so components that call
 * {@link useAccountId} can still be rendered in isolation (tests, storybook,
 * story surfaces) without a provider wrapping them — the same pattern used by
 * `useFetchTracker`.
 */

/** A Callora account the signed-in user can act as. */
export interface CalloraAccount {
  id: string;
  name: string;
}

/** Accounts available before the real account list is loaded. */
export const DEFAULT_ACCOUNTS: readonly CalloraAccount[] = [
  { id: "acct_primary", name: "Primary account" },
  { id: "acct_secondary", name: "Secondary account" },
];

/** Account selected when nothing has been persisted yet. */
export const DEFAULT_ACCOUNT_ID = DEFAULT_ACCOUNTS[0].id;

/** localStorage key holding the active account id. */
export const ACTIVE_ACCOUNT_STORAGE_KEY = "callora.activeAccountId";

export interface AccountContextValue {
  accounts: readonly CalloraAccount[];
  /** Id of the account currently being acted on. */
  accountId: string;
  /** The active account record. */
  account: CalloraAccount;
  /** Switch the active account. Unknown ids are ignored. */
  setAccountId: (accountId: string) => void;
}

const noop = () => {};

const defaultContextValue: AccountContextValue = {
  accounts: DEFAULT_ACCOUNTS,
  accountId: DEFAULT_ACCOUNT_ID,
  account: DEFAULT_ACCOUNTS[0],
  setAccountId: noop,
};

const AccountContext = createContext<AccountContextValue>(defaultContextValue);

export interface AccountProviderProps {
  children: ReactNode;
  /** Account list to offer in the switcher. Defaults to {@link DEFAULT_ACCOUNTS}. */
  accounts?: readonly CalloraAccount[];
  /** Account to start on. Defaults to the persisted selection. */
  initialAccountId?: string;
}

/**
 * Provides the active account to the tree and persists selections so a reload
 * does not silently jump the user back to another account.
 */
export function AccountProvider({
  children,
  accounts = DEFAULT_ACCOUNTS,
  initialAccountId,
}: AccountProviderProps) {
  const [persistedAccountId, setPersistedAccountId] = usePersistedState<string>(
    ACTIVE_ACCOUNT_STORAGE_KEY,
    initialAccountId ?? DEFAULT_ACCOUNT_ID,
  );

  const isKnownAccount = accounts.some((account) => account.id === persistedAccountId);

  // A stale or hand-edited localStorage value must never select a phantom
  // account, otherwise every account-scoped request would 404.
  const accountId = initialAccountId ?? (isKnownAccount ? persistedAccountId : DEFAULT_ACCOUNT_ID);

  const setAccountId = useCallback(
    (nextAccountId: string) => {
      if (!accounts.some((account) => account.id === nextAccountId)) return;
      setPersistedAccountId(nextAccountId);
    },
    [accounts, setPersistedAccountId],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts,
      accountId,
      account: accounts.find((account) => account.id === accountId) ?? accounts[0],
      setAccountId,
    }),
    [accounts, accountId, setAccountId],
  );

  return createElement(AccountContext.Provider, { value }, children);
}

/** Full account context: list, active account, and the switch action. */
export function useAccounts(): AccountContextValue {
  return useContext(AccountContext);
}

/**
 * Id of the account the UI is currently acting on.
 *
 * Returns {@link DEFAULT_ACCOUNT_ID} when rendered outside an
 * {@link AccountProvider} instead of throwing, so leaf components stay
 * renderable on their own.
 */
export function useAccountId(): string {
  return useContext(AccountContext).accountId;
}

export default AccountProvider;
import { useEffect, useSyncExternalStore, useCallback } from "react";
import { getCurrentAccount, getCurrentAccountId, switchAccount, subscribe, type Account } from "../state/accountStore";
import { invalidateAccountCache } from "../utils/offlineApiCache";

export function useAccount(): Account | null {
  const getSnapshot = useCallback(() => getCurrentAccount(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAccountId(): string | null {
  const getSnapshot = useCallback(() => getCurrentAccountId(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSwitchAccount(): (accountId: string) => void {
  return useCallback((accountId: string) => {
    const current = getCurrentAccountId();
    if (current && current !== accountId) {
      invalidateAccountCache(current);
    }
    switchAccount(accountId);
  }, []);
}

export function useInvalidateCache(): (accountId: string) => void {
  return useCallback((accountId: string) => {
    invalidateAccountCache(accountId);
  }, []);
}
