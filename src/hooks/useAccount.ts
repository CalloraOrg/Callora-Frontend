import { useSyncExternalStore, useCallback } from "react";
import { getCurrentAccount, getCurrentAccountId, switchAccount, subscribe, type Account, removeAccount, renameAccount } from "../state/accountStore";
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

export function useRemoveAccount(): (accountId: string) => void {
  return useCallback((accountId: string) => {
    const current = getCurrentAccount();
    const isCurrent = current?.id === accountId;
    removeAccount(accountId);
    if (isCurrent) {
      const remaining = getCurrentAccount();
      if (remaining) {
        invalidateAccountCache(accountId);
      }
    }
  }, []);
}

export function useRenameAccount(): (accountId: string, newLabel: string) => boolean {
  return useCallback((accountId: string, newLabel: string) => {
    return renameAccount(accountId, newLabel);
  }, []);
}
