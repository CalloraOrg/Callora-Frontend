import { useCallback, useEffect } from "react";
import { useAccountId, useInvalidateCache } from "./useAccount";
import { getCache, setCache, type CacheEntry } from "../utils/offlineApiCache";

export function useApiCache<T = unknown>() {
  const accountId = useAccountId();
  const invalidateCache = useInvalidateCache();

  const get = useCallback(
    (cacheKey: string): T | null => {
      if (!accountId) return null;
      return getCache<T>(accountId, cacheKey);
    },
    [accountId],
  );

  const set = useCallback(
    (cacheKey: string, data: T, ttl?: number): void => {
      if (!accountId) return;
      setCache<T>(accountId, cacheKey, data, ttl);
    },
    [accountId],
  );

  const invalidate = useCallback(
    (key?: string) => {
      if (!accountId) return;
      if (key) {
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(`callora_api_cache_${accountId}_${key}`);
          } catch {
            /* ignore */
          }
        }
      } else {
        invalidateCache(accountId);
      }
    },
    [accountId, invalidateCache],
  );

  useEffect(() => {
    if (!accountId) return;
    invalidateCache(accountId);
  }, [accountId, invalidateCache]);

  return { get, set, invalidate, accountId };
}
