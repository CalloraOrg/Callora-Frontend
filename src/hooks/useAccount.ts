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
