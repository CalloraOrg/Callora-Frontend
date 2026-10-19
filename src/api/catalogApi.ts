import type { APIItem } from "../data/mockApis";
import { getApiBaseUrl } from "../config/api";

export interface CatalogParams {
  search?: string;
  category?: string;
}

export interface CatalogResponse {
  items: APIItem[];
  total: number;
  page: number;
  pageSize: number;
}

const CACHE_KEY_PREFIX = "callora-catalog-cache-";

function getBaseUrl(): string {
  const base = getApiBaseUrl();
  return base && base.trim() ? base : "https://api.callora.com";
}

export function buildCacheKey(params: CatalogParams): string {
  const searchParams = new URLSearchParams();
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.category?.trim()) {
    searchParams.set("category", params.category.trim());
  }
  return `${CACHE_KEY_PREFIX}${searchParams.toString() || "all"}`;
}

function getCachedResponse(key: string): CatalogResponse | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function setCachedResponse(key: string, response: CatalogResponse): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(response));
  } catch {
    // Ignore quota errors
  }
}

export async function fetchCatalog(
  signal: AbortSignal,
  params: CatalogParams = {}
): Promise<CatalogResponse> {
  const cacheKey = buildCacheKey(params);
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return cached;
  }

  const searchParams = new URLSearchParams();
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.category?.trim()) {
    searchParams.set("category", params.category.trim());
  }

  const queryString = searchParams.toString();
  const url = `${getBaseUrl()}/api/apis${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch catalog: ${response.statusText}`);
  }

  const data = (await response.json()) as CatalogResponse;
  setCachedResponse(cacheKey, data);
  return data;
}

export function clearCatalogCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore errors
  }
}