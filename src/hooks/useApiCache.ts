import { useCallback } from "react";
import { useAccountId, useInvalidateCache } from "./useAccount";
import { getCache, setCache, type CacheEntry } from "../utils/offlineApiCache";

/**
 * Return interface for the {@link useApiCache} hook.
 *
 * @template T - The type of data stored in cache entries.
 */
export interface UseApiCacheReturn<T> {
  /**
   * Retrieves cached data for a specific cache key under the active account.
   *
   * @param cacheKey - Cache key identifier.
   * @returns The cached data of type `T`, or `null` if expired, not found, or no active account.
   */
  get: (cacheKey: string) => T | null;

  /**
   * Stores data in `localStorage` under the active account namespace.
   *
   * @param cacheKey - Cache key identifier.
   * @param data - The data payload to cache.
   * @param ttl - Optional time-to-live in milliseconds. If omitted, the default TTL applies.
   */
  set: (cacheKey: string, data: T, ttl?: number) => void;

  /**
   * Invalidates cached data. If `key` is provided, removes only that cache entry;
   * if omitted, wipes all cache entries for the current active account.
   *
   * @param key - Optional specific cache key to remove.
   */
  invalidate: (key?: string) => void;

  /** Currently active account ID, or `null` if not authenticated. */
  accountId: string | null;
}

/**
 * Manages account-scoped offline API response caching in `localStorage`.
 *
 * Caches entries using keys namespaced by the active account (`callora_api_cache_<accountId>_<key>`).
 * Automatically synchronizes with account context changes via `useAccountId()`. If no account is
 * active (`accountId` is `null`), read operations return `null` and write/invalidation operations are no-ops.
 *
 * Side effects:
 * - **Invalidate on mount**: On initial component mount (and whenever `accountId` changes),
 *   this hook automatically executes `invalidateCache(accountId)` via a `useEffect`, wiping all
 *   existing cached API entries for that account from `localStorage`.
 * - **LocalStorage writes/removals**: Directly mutates `window.localStorage` when setting entries
 *   or invalidating keys.
 *
 * @template T - Type of the cached payload. Defaults to `unknown`.
 * @returns A {@link UseApiCacheReturn} object containing:
 * - `get`: Function to retrieve cached data by key for the active account (`(cacheKey: string) => T | null`).
 * - `set`: Function to persist data into cache with an optional TTL (`(cacheKey: string, data: T, ttl?: number) => void`).
 * - `invalidate`: Function to remove a specific key or wipe the active account's cache (`(key?: string) => void`).
 * - `accountId`: The currently active account ID (`string | null`).
 *
 * @example
 * ```tsx
 * interface EndpointStatus {
 *   endpoint: string;
 *   healthy: boolean;
 * }
 *
 * function EndpointMonitor() {
 *   const { get, set, invalidate, accountId } = useApiCache<EndpointStatus>();
 *   const cachedStatus = get("status_endpoint_1");
 *
 *   const refreshStatus = async () => {
 *     const res = await fetch("/api/endpoint/1/status");
 *     const data: EndpointStatus = await res.json();
 *     set("status_endpoint_1", data, 30_000); // cache for 30s
 *   };
 *
 *   return (
 *     <div>
 *       <p>Account: {accountId}</p>
 *       <p>Status: {cachedStatus?.healthy ? "Online" : "Unknown"}</p>
 *       <button onClick={refreshStatus}>Refresh</button>
 *       <button onClick={() => invalidate("status_endpoint_1")}>Clear Key</button>
 *       <button onClick={() => invalidate()}>Wipe Account Cache</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useApiCache<T = unknown>(): UseApiCacheReturn<T> {
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
            window.localStorage.removeItem(
              `callora_api_cache_${accountId}_${key}`,
            );
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

  return { get, set, invalidate, accountId };
}
