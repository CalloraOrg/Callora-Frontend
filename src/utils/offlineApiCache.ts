const CACHE_PREFIX = "callora_api_cache";
const META_PREFIX = "callora_api_cache_meta";
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  accountId: string;
  ttl: number;
}

export interface CacheMeta {
  accountId: string;
  version: number;
  invalidatedAt: number;
}

function storageKey(accountId: string, cacheKey: string): string {
  return `${CACHE_PREFIX}_${accountId}_${cacheKey}`;
}

function metaKey(accountId: string): string {
  return `${META_PREFIX}_${accountId}`;
}

function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const test = "__storage_test__";
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getCache<T = unknown>(accountId: string, cacheKey: string): T | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(accountId, cacheKey));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.accountId !== accountId) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      window.localStorage.removeItem(storageKey(accountId, cacheKey));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T = unknown>(accountId: string, cacheKey: string, data: T, ttl = DEFAULT_TTL_MS): void {
  if (!isStorageAvailable()) return;
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accountId,
      ttl,
    };
    window.localStorage.setItem(storageKey(accountId, cacheKey), JSON.stringify(entry));
  } catch {
    /* storage full or blocked — silently ignore */
  }
}

export function invalidateAccountCache(accountId: string): void {
  if (!isStorageAvailable()) return;
  try {
    const meta: CacheMeta = {
      accountId,
      version: Date.now(),
      invalidatedAt: Date.now(),
    };
    window.localStorage.setItem(metaKey(accountId), JSON.stringify(meta));
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(`${CACHE_PREFIX}_${accountId}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export function isCacheEntryValid(accountId: string, cacheKey: string): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const raw = window.localStorage.getItem(storageKey(accountId, cacheKey));
    if (!raw) return false;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.accountId !== accountId) return false;
    if (Date.now() - entry.timestamp > entry.ttl) {
      window.localStorage.removeItem(storageKey(accountId, cacheKey));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
