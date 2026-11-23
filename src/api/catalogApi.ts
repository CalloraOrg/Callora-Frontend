/*
 * catalogApi.ts
 *
 * Catalogue (marketplace listing) API used by MarketplacePage.
 *
 * The marketplace is the one surface that must never be served from a list
 * compiled into the bundle: APIs are published at runtime, so the page has to
 * ask the backend what exists right now. This module owns that wire protocol so
 * the page component never touches `fetch` directly and the request stays
 * unit-testable via the injected {@link CreateCatalogApiOptions.fetchImpl}.
 *
 * The shape mirrors `quotaApi.ts` deliberately: a factory that returns an
 * object with a catalogue method and a detail method, and a shared singleton
 * for app code. Every call accepts an optional `AbortSignal` so a superseded
 * request (newer navigation) or an unmounting page can cancel the in-flight
 * call without ever resolving into a dead component.
 *
 * The module deliberately reports failures by *rejecting* rather than by
 * returning a result union: the page needs to distinguish "the request failed"
 * from "the catalogue is legitimately empty", and a rejection (checked with
 * {@link isCatalogAbortError}) is the idiomatic way to say that.
 */

import { API_BASE, API_BASE_URL, apiUrl } from "../config/constants";
import MOCK_APIS, { type APIItem, type ApiEndpointItem } from "../data/mockApis";
import { onAccountCacheInvalidated } from "../utils/offlineApiCache";
import type { HealthStatus } from "../components/HealthTimeline";

/** Path the marketplace catalogue is read from. */
export const CATALOG_PATH = "/api/apis";

/** Key the last good catalogue is cached under (scoped per account). */
export const CATALOG_CACHE_KEY = "catalog";

export const CACHE_KEY_PREFIX = "callora-catalog-cache-";

export interface CatalogParams {
  search?: string;
  category?: string;
}

export interface CatalogResponse {
  items: APIItem[];
  total?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Builds a unique cache key including server query parameters.
 * This ensures a filtered response never overwrites an unfiltered cache.
 */
export function buildCacheKey(params: CatalogParams = {}): string {
  const searchParams = new URLSearchParams();
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.category?.trim()) {
    searchParams.set("category", params.category.trim());
  }
  const qs = searchParams.toString();
  return `${CACHE_KEY_PREFIX}${qs || "all"}`;
}

const resolverCacheClearHandlers = new Set<() => void>();

/**
 * Clears cached catalog responses from sessionStorage and resets in-memory
 * resolver caches across catalog API instances.
 */
export function clearCatalogCache(): void {
  for (const clear of resolverCacheClearHandlers) {
    try {
      clear();
    } catch {
      // Ignore errors
    }
  }
  if (typeof sessionStorage === "undefined") return;
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

onAccountCacheInvalidated(() => {
  clearCatalogCache();
});

export type ApiDetail = APIItem;

/**
 * Result of a single-API detail fetch.
 *
 * The detail page needs to distinguish "not found" (a 404 or a 400 from a
 * non-integer id) from "the request failed", so 404/400 resolve to this typed
 * result instead of rejecting. Other failures reject with
 * {@link CatalogFetchError}.
 */
export type ApiDetailResult =
  | { status: "ready"; kind?: "ready"; api: APIItem }
  | { status: "not-found"; kind: "not-found"; api?: undefined };

export interface ResolvedApisResult {
  /** Resolved APIs in the order their ids were requested (deduplicated). */
  apis: APIItem[];
  /** Requested ids that returned not-found / no longer exist. */
  missing: string[];
}

export interface CatalogApi {
  /**
   * Fetches the marketplace catalogue.
   *
   * @param signal Aborts the request; rejects with an `AbortError` when
   *   aborted before the response is read.
   * @param params Optional server-side search and category filter parameters.
   */
  fetchCatalog(signal?: AbortSignal, params?: CatalogParams): Promise<APIItem[]>;

  /**
   * Fetches a single API by id.
   *
   * @param id The API id (stringified) to look up.
   * @param signal Aborts the request; rejects with an `AbortError` when
   *   aborted before the response is read.
   */
  fetchApiDetail(id: string, signal?: AbortSignal): Promise<ApiDetailResult>;

  /**
   * Fetches health timeline buckets for a single API from `GET /api/apis/:id/health`.
   *
   * Expected payload shape:
   * `{ points: Array<{ at: string; status: "operational" | "degraded" | "down" }> }`
   *
   * @param id The API id to look up.
   * @param signal Aborts the request; rejects with an `AbortError` when aborted.
   */
  fetchApiHealth(id: string, signal?: AbortSignal): Promise<HealthStatus[]>;

  /**
   * Resolves a list of API ids from the cached catalogue, fetching any missing
   * ids via {@link fetchApiDetail} and deduplicating in-flight requests.
   */
  resolveApisByIds(
    ids: readonly string[],
    signal?: AbortSignal,
  ): Promise<ResolvedApisResult>;
}

export interface CreateCatalogApiOptions {
  /** Base URL the catalogue is read from. Defaults to {@link API_BASE_URL}. */
  baseUrl?: string;
  /** Injectable for tests. Defaults to the ambient `fetch`. */
  fetchImpl?: typeof fetch;
}

/** Raised when the catalogue could not be loaded. */
export class CatalogFetchError extends Error {
  /** HTTP status when the failure came from a response, else `null`. */
  public readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "CatalogFetchError";
    this.status = status;
  }
}

/**
 * Distinguishes "the caller cancelled" from "the request failed".
 *
 * A cancellation is not an error the UI should surface — the page drops the
 * result and keeps whatever it already had — so both the page and the tests
 * need a reliable predicate rather than string-matching messages.
 */
export function isCatalogAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface BackendDeveloper {
  name?: string;
  website?: string;
  description?: string;
}

export interface BackendEndpoint {
  id?: string | number;
  path?: string;
  method?: string;
  price?: number;
  price_per_call?: number;
  price_per_request?: number;
  pricing?: number;
  cost?: number;
  [key: string]: unknown;
}

/**
 * Adapts a raw backend API row into the frontend's {@link APIItem}.
 *
 * Returns `null` if the row lacks an `id` or `name`, dropping broken rows
 * before they can render with missing fields.
 */
export function adaptBackendApi(raw: unknown): APIItem | null {
  if (!isRecord(raw)) return null;

  const rawId = raw.id;
  if (rawId === null || rawId === undefined || rawId === "") return null;
  const id = String(rawId).trim();
  if (!id) return null;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;

  const description =
    typeof raw.description === "string" ? raw.description : "";
  const category = typeof raw.category === "string" ? raw.category : undefined;

  let providerName = "Unknown provider";
  let providerUrl: string | undefined;
  let providerAvatar: string | undefined;

  if (isRecord(raw.developer)) {
    const dev = raw.developer as BackendDeveloper;
    if (typeof dev.name === "string" && dev.name.trim()) {
      providerName = dev.name.trim();
    }
    if (typeof dev.website === "string" && dev.website.trim()) {
      providerUrl = dev.website.trim();
    }
  } else if (isRecord(raw.provider)) {
    const prov = raw.provider as Record<string, unknown>;
    if (typeof prov.name === "string" && prov.name.trim()) {
      providerName = prov.name.trim();
    }
    if (typeof prov.url === "string" && prov.url.trim()) {
      providerUrl = prov.url.trim();
    }
    if (typeof prov.avatar === "string" && prov.avatar.trim()) {
      providerAvatar = prov.avatar.trim();
    }
  }

  let status: APIItem["status"] = undefined;
  if (
    raw.status === "operational" ||
    raw.status === "degraded" ||
    raw.status === "maintenance"
  ) {
    status = raw.status;
  }

  const baseUrl =
    typeof raw.baseUrl === "string"
      ? raw.baseUrl
      : typeof raw.base_url === "string"
        ? raw.base_url
        : undefined;

  if (!providerAvatar && typeof raw.logo_url === "string") {
    providerAvatar = raw.logo_url;
  }

  // Derive price per request from endpoints if present
  let pricePerRequest = 0;
  let pricingOnRequest = false;

  const endpoints = Array.isArray(raw.endpoints) ? raw.endpoints : [];
  if (endpoints.length > 0) {
    const prices = endpoints
      .map((ep: unknown) => {
        if (!isRecord(ep)) return null;
        const p =
          ep.price ?? ep.price_per_call ?? ep.price_per_request ?? ep.pricing ?? ep.cost;
        return typeof p === "number" && !Number.isNaN(p) ? p : null;
      })
      .filter((p): p is number => p !== null);

    if (prices.length > 0) {
      pricePerRequest = Math.min(...prices);
    } else {
      pricingOnRequest = true;
    }
  } else if (typeof raw.pricePerRequest === "number") {
    pricePerRequest = raw.pricePerRequest;
  } else if (typeof raw.price_per_request === "number") {
    pricePerRequest = raw.price_per_request;
  } else if (typeof raw.price === "number") {
    pricePerRequest = raw.price;
  }

  return {
    id,
    name,
    description,
    category,
    provider: {
      name: providerName,
      url: providerUrl,
      avatar: providerAvatar,
    },
    status,
    baseUrl,
    pricePerRequest,
    pricingOnRequest,
    endpoints: endpoints.length > 0 ? (endpoints as ApiEndpointItem[]) : undefined,
  };
}

/**
 * Normalises the catalogue payload.
 *
 * Accepts both legacy `APIItem` shapes and backend rows via `adaptBackendApi`.
 */
export function normalizeCatalog(payload: unknown): APIItem[] {
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : isRecord(payload) && Array.isArray(payload.apis)
        ? payload.apis
        : isRecord(payload) && Array.isArray(payload.items)
          ? payload.items
          : null;

  if (!list) {
    throw new CatalogFetchError("The catalogue response was not a list of APIs.");
  }

  const items: APIItem[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;

    if (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      isRecord(item.provider) &&
      typeof (item.provider as { name?: unknown }).name === "string"
    ) {
      items.push(item as unknown as APIItem);
    } else {
      const adapted = adaptBackendApi(item);
      if (adapted) {
        items.push(adapted);
      }
    }
  }

  return items;
}

/**
 * Normalises a single-API detail payload into the frontend `APIItem`.
 */
export function normalizeApiDetail(payload: unknown): APIItem | null {
  if (isRecord(payload) && isRecord(payload.data)) {
    return adaptBackendApi(payload.data);
  }
  return adaptBackendApi(payload);
}

const VALID_HEALTH_STATUSES = new Set<HealthStatus>([
  "operational",
  "degraded",
  "down",
]);

function isHealthStatus(value: unknown): value is HealthStatus {
  return (
    typeof value === "string" &&
    VALID_HEALTH_STATUSES.has(value as HealthStatus)
  );
}

/**
 * Expected response payload for `GET /api/apis/:id/health`:
 * `{ points: Array<{ at: string; status: "operational" | "degraded" | "down" }> }`
 *
 * Normalises the payload into an array of validated {@link HealthStatus} values,
 * dropping any entries with unknown or malformed status values.
 */
export function normalizeApiHealth(payload: unknown): HealthStatus[] {
  const container =
    isRecord(payload) && isRecord(payload.data) ? payload.data : payload;

  const rawPoints = isRecord(container) && Array.isArray(container.points)
    ? container.points
    : Array.isArray(container)
      ? container
      : null;

  if (!rawPoints) {
    return [];
  }

  const statuses: HealthStatus[] = [];
  for (const point of rawPoints) {
    const rawStatus = isRecord(point) ? point.status : point;
    if (isHealthStatus(rawStatus)) {
      statuses.push(rawStatus);
    }
  }
  return statuses;
}

/**
 * Creates a catalogue API. Tests inject a `fetchImpl`; app code uses the
 * shared {@link catalogApi} singleton.
 */
export function createCatalogApi(
  options: CreateCatalogApiOptions = {},
): CatalogApi {
  const fetchImpl: typeof fetch =
    options.fetchImpl ?? ((...args) => globalThis.fetch(...args));

  const cachedEtags = new Map<string, string>();
  const cachedLists = new Map<string, APIItem[]>();
  const resolvedById = new Map<string, APIItem>();
  const resolvedNotFound = new Set<string>();
  const inFlightById = new Map<string, Promise<ApiDetailResult>>();

  resolverCacheClearHandlers.add(() => {
    cachedEtags.clear();
    cachedLists.clear();
    resolvedById.clear();
    resolvedNotFound.clear();
    inFlightById.clear();
  });

  const resolveBase = (): string =>
    options.baseUrl !== undefined
      ? options.baseUrl.replace(/\/+$/, "")
      : "";

  const api: CatalogApi = {
    async fetchCatalog(signal, params = {}) {
      if (signal?.aborted) {
        throw abortError();
      }

      const searchParams = new URLSearchParams();
      if (params.search?.trim()) {
        searchParams.set("search", params.search.trim());
      }
      if (params.category?.trim()) {
        searchParams.set("category", params.category.trim());
      }

      const queryString = searchParams.toString();
      const pathWithQuery = queryString ? `${CATALOG_PATH}?${queryString}` : CATALOG_PATH;

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      const etag = cachedEtags.get(pathWithQuery);
      if (etag) {
        headers["If-None-Match"] = etag;
      }

      const base = resolveBase();
      const targetUrl = base ? `${base}${pathWithQuery}` : apiUrl(pathWithQuery);

      let response: Response;
      try {
        response = await fetchImpl(targetUrl, {
          method: "GET",
          headers,
          signal,
        });
      } catch (err) {
        if (signal?.aborted || isCatalogAbortError(err)) {
          throw abortError();
        }
        throw new CatalogFetchError("Could not reach the marketplace service.");
      }

      if (signal?.aborted) {
        throw abortError();
      }

      if (response.status === 304) {
        return cachedLists.get(pathWithQuery) ?? [];
      }

      if (!response.ok) {
        throw new CatalogFetchError(
          `Failed to fetch catalog: ${response.statusText || response.status}`,
          response.status,
        );
      }

      const newEtag = response.headers.get("etag") ?? response.headers.get("ETag");
      if (newEtag) {
        cachedEtags.set(pathWithQuery, newEtag);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (err) {
        if (signal?.aborted || isCatalogAbortError(err)) {
          throw abortError();
        }
        throw new CatalogFetchError(
          "The marketplace service returned an unreadable response.",
        );
      }

      if (signal?.aborted) {
        throw abortError();
      }

      const items = normalizeCatalog(payload);
      cachedLists.set(pathWithQuery, items);
      for (const item of items) {
        resolvedById.set(item.id, item);
        resolvedNotFound.delete(item.id);
      }

      return items;
    },

    async fetchApiDetail(id, signal) {
      if (signal?.aborted) {
        throw abortError();
      }

      const base = resolveBase();
      const path = `${CATALOG_PATH}/${encodeURIComponent(id)}`;
      const targetUrl = base ? `${base}${path}` : apiUrl(path);

      let response: Response;
      try {
        response = await fetchImpl(targetUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal,
        });
      } catch (err) {
        if (signal?.aborted || isCatalogAbortError(err)) {
          throw abortError();
        }
        throw new CatalogFetchError("Could not reach the marketplace service.");
      }

      if (signal?.aborted) {
        throw abortError();
      }

      if (response.status === 404 || response.status === 400) {
        resolvedNotFound.add(id);
        resolvedById.delete(id);
        return { status: "not-found", kind: "not-found" };
      }

      if (!response.ok) {
        throw new CatalogFetchError(
          "The marketplace service is unavailable right now.",
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (err) {
        if (signal?.aborted || isCatalogAbortError(err)) {
          throw abortError();
        }
        throw new CatalogFetchError(
          "The marketplace service returned an unreadable response.",
        );
      }

      if (signal?.aborted) {
        throw abortError();
      }

      const item = normalizeApiDetail(payload);
      if (!item) {
        throw new CatalogFetchError(
          "The marketplace service returned an unreadable response.",
        );
      }
      resolvedById.set(id, item);
      resolvedNotFound.delete(id);
      return { status: "ready", kind: "ready", api: item };
    },

    async fetchApiHealth(id, signal) {
      if (signal?.aborted) {
        throw abortError();
      }

      const base = resolveBase();
      const path = `${CATALOG_PATH}/${encodeURIComponent(id)}/health`;
      const targetUrl = base ? `${base}${path}` : apiUrl(path);

      let response: Response;
      try {
        response = await fetchImpl(targetUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal,
        });
      } catch (err) {
        if (signal?.aborted || isCatalogAbortError(err)) {
          throw abortError();
        }
        throw new CatalogFetchError("Could not reach the health service.");
      }

      if (signal?.aborted) {
        throw abortError();
      }

      if (response.status === 404 || response.status === 400) {
        return [];
      }

      if (!response.ok) {
        throw new CatalogFetchError(
          `Failed to fetch API health: ${response.statusText || response.status}`,
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (err) {
        if (signal?.aborted || isCatalogAbortError(err)) {
          throw abortError();
        }
        throw new CatalogFetchError(
          "The health service returned an unreadable response.",
        );
      }

      if (signal?.aborted) {
        throw abortError();
      }

      return normalizeApiHealth(payload);
    },

    async resolveApisByIds(ids, signal) {
      if (signal?.aborted) {
        throw abortError();
      }

      if (ids.length === 0) {
        return { apis: [], missing: [] };
      }

      const uniqueIds: string[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          uniqueIds.push(id);
        }
      }

      const toFetch: Array<{ id: string; promise: Promise<ApiDetailResult> }> = [];
      for (const id of uniqueIds) {
        if (resolvedById.has(id) || resolvedNotFound.has(id)) {
          continue;
        }
        let inFlight = inFlightById.get(id);
        if (!inFlight) {
          const request = api.fetchApiDetail(id).finally(() => {
            if (inFlightById.get(id) === request) {
              inFlightById.delete(id);
            }
          });
          inFlightById.set(id, request);
          inFlight = request;
        }
        toFetch.push({ id, promise: inFlight });
      }

      if (toFetch.length > 0) {
        await raceWithAbort(
          Promise.all(toFetch.map((entry) => entry.promise)),
          signal,
        );
      }

      if (signal?.aborted) {
        throw abortError();
      }

      const apis: APIItem[] = [];
      const missing: string[] = [];
      for (const id of uniqueIds) {
        const cached = resolvedById.get(id);
        if (cached) {
          apis.push(cached);
        } else {
          missing.push(id);
        }
      }

      return { apis, missing };
    },
  };

  return api;
}

/** Shared catalogue API used by the app. */
export const catalogApi: CatalogApi = createCatalogApi({
  baseUrl: API_BASE || undefined,
});

/**
 * Reads the marketplace catalogue.
 *
 * Exported as a standalone function (rather than only the singleton) so tests
 * can `vi.mock` this module with a single replacement and drive every
 * loading / success / failure path of the page.
 */
export async function fetchCatalog(
  signal?: AbortSignal,
  params?: CatalogParams,
): Promise<APIItem[]> {
  // No backend configured (static demo deployment): use the bundled sample
  // catalogue instead of firing a request that can only fail.
  if (!API_BASE) return MOCK_APIS;

  // When API_BASE is configured, errors must reject so the UI surfaces its
  // error or stale-data states rather than hiding failures behind mock data.
  return await catalogApi.fetchCatalog(signal, params);
}

/**
 * Reads a single API detail from `GET /api/apis/:id`.
 */
export async function fetchApiDetail(
  id: string,
  signal?: AbortSignal,
): Promise<ApiDetailResult> {
  if (signal?.aborted) {
    throw abortError();
  }

  if (!API_BASE) {
    const found = MOCK_APIS.find((api) => api.id === id);
    return found
      ? { status: "ready", kind: "ready", api: found }
      : { status: "not-found", kind: "not-found" };
  }

  return await catalogApi.fetchApiDetail(id, signal);
}

/**
 * Reads health timeline buckets from `GET /api/apis/:id/health`.
 *
 * Expected payload: `{ points: Array<{ at: string; status: HealthStatus }> }`.
 * In static demo mode (when `API_BASE` is unset), returns an empty array so the
 * UI renders the empty state rather than throwing.
 */
export async function fetchApiHealth(
  id: string,
  signal?: AbortSignal,
): Promise<HealthStatus[]> {
  if (signal?.aborted) {
    throw abortError();
  }

  if (!API_BASE) {
    return [];
  }

  return await catalogApi.fetchApiHealth(id, signal);
}

/**
 * Resolves a list of API ids from the cached catalogue or `GET /api/apis/:id`.
 */
export async function resolveApisByIds(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<ResolvedApisResult> {
  if (signal?.aborted) {
    throw abortError();
  }

  if (ids.length === 0) {
    return { apis: [], missing: [] };
  }

  if (!API_BASE) {
    const uniqueIds = Array.from(new Set(ids));
    const mockById = new Map(MOCK_APIS.map((item) => [item.id, item]));
    const apis: APIItem[] = [];
    const missing: string[] = [];
    for (const id of uniqueIds) {
      const found = mockById.get(id);
      if (found) {
        apis.push(found);
      } else {
        missing.push(id);
      }
    }
    return { apis, missing };
  }

  return await catalogApi.resolveApisByIds(ids, signal);
}
