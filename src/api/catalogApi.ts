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
import MOCK_APIS, { type APIItem } from "../data/mockApis";

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

/**
 * Clears cached catalog responses from sessionStorage.
 */
export function clearCatalogCache(): void {
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

/**
 * Result of a single-API detail fetch.
 *
 * The detail page needs to distinguish "not found" (a 404 or a 400 from a
 * non-integer id) from "the request failed", so 404/400 resolve to this typed
 * result instead of rejecting. Other failures reject with
 * {@link CatalogFetchError}.
 */
export type ApiDetailResult =
  | { status: "ready"; api: APIItem }
  | { status: "not-found" };

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

  const statusRaw = raw.status;
  const status =
    statusRaw === "operational" ||
    statusRaw === "degraded" ||
    statusRaw === "down"
      ? statusRaw
      : undefined;

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
    endpoints: endpoints.length > 0 ? (endpoints as Array<any>) : undefined,
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

/**
 * Creates a catalogue API. Tests inject a `fetchImpl`; app code uses the
 * shared {@link catalogApi} singleton.
 */
export function createCatalogApi(
  options: CreateCatalogApiOptions = {},
): CatalogApi {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  const cachedEtags = new Map<string, string>();
  const cachedLists = new Map<string, APIItem[]>();

  const resolveBase = (): string =>
    options.baseUrl !== undefined
      ? options.baseUrl.replace(/\/+$/, "")
      : "";

  return {
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
        return { status: "not-found" };
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

      const api = normalizeApiDetail(payload);
      if (!api) {
        throw new CatalogFetchError(
          "The marketplace service returned an unreadable response.",
        );
      }
      return { status: "ready", api };
    },
  };
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
    return found ? { status: "ready", api: found } : { status: "not-found" };
  }

  return await catalogApi.fetchApiDetail(id, signal);
}
