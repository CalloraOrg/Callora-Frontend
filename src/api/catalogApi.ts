/**
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
 * object with a single `fetchCatalog(signal?)` method, and a shared singleton
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

export interface CatalogApi {
  /**
   * Fetches the full marketplace catalogue.
   *
   * @param signal Aborts the request; rejects with an `AbortError` when
   *   aborted before the response is read.
   */
  fetchCatalog(signal?: AbortSignal): Promise<APIItem[]>;
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

export interface BackendApiRow {
  id: string | number;
  name: string;
  description?: string;
  base_url?: string;
  logo_url?: string;
  category?: string;
  status?: string;
  developer?: BackendDeveloper;
  endpoints?: BackendEndpoint[];
  [key: string]: unknown;
}

/**
 * Adapts a snake_case, cursor-paginated Callora-Backend API row into the
 * frontend `APIItem` contract.
 *
 * Rules:
 * - Stringifies `id`.
 * - Maps `developer.name` to `provider.name` (fallback "Unknown provider") and
 *   `developer.website` to `provider.url`.
 * - Maps `logo_url` to `provider.avatar` and `base_url` to `baseUrl`.
 * - Maps backend `status` to UI enum, unknown values become `undefined`.
 * - Derives `pricePerRequest` from the minimum endpoint price when endpoints
 *   carry pricing, and otherwise leaves it as 0 with `pricingOnRequest: true`.
 * - Drops invalid rows (e.g. `id == null`, missing/empty `name`) by returning `null`.
 */
export function adaptBackendApi(row: unknown): APIItem | null {
  if (!isRecord(row)) return null;

  if (row.id === null || row.id === undefined) return null;
  const idStr = String(row.id).trim();
  if (!idStr) return null;

  if (typeof row.name !== "string" || !row.name.trim()) return null;

  const developer = isRecord(row.developer) ? (row.developer as BackendDeveloper) : null;
  const providerName = developer?.name?.trim() || "Unknown provider";
  const providerUrl = developer?.website?.trim() || undefined;
  const providerAvatar = typeof row.logo_url === "string" ? row.logo_url : undefined;
  const baseUrl = typeof row.base_url === "string" ? row.base_url : undefined;

  let status: APIItem["status"] = undefined;
  if (row.status === "operational" || row.status === "degraded" || row.status === "maintenance") {
    status = row.status;
  }

  // Derive pricing from endpoints
  let pricePerRequest = 0;
  let pricingOnRequest = false;

  const endpoints = Array.isArray(row.endpoints) ? row.endpoints : [];
  const prices: number[] = [];
  for (const ep of endpoints) {
    if (isRecord(ep)) {
      const p = ep.price ?? ep.price_per_call ?? ep.price_per_request ?? ep.pricing ?? ep.cost;
      if (typeof p === "number" && Number.isFinite(p) && p >= 0) {
        prices.push(p);
      }
    }
  }

  if (prices.length > 0) {
    pricePerRequest = Math.min(...prices);
    pricingOnRequest = false;
  } else {
    pricePerRequest = 0;
    pricingOnRequest = true;
  }

  return {
    id: idStr,
    name: row.name.trim(),
    provider: {
      name: providerName,
      url: providerUrl,
      avatar: providerAvatar,
    },
    description: typeof row.description === "string" ? row.description : "",
    category: typeof row.category === "string" ? row.category : undefined,
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
 * The backend may answer with a bare array or wrap it (`{ data: [...] }` /
 * `{ apis: [...] }`); both are accepted so a response-shape change is a
 * one-line fix here rather than a page rewrite. Entries that are not objects
 * carrying the two fields the marketplace cannot render without (`id` and
 * `name`) are dropped instead of poisoning the list, so one malformed row does
 * not take the whole page down.
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
        : null;

  if (!list) {
    throw new CatalogFetchError("The catalogue response was not a list of APIs.");
  }

  const items: APIItem[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;

    // Legacy shape check: string id, string name, provider object with string name
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
 * Creates a catalogue API. Tests inject a `fetchImpl`; app code uses the
 * shared {@link catalogApi} singleton.
 */
export function createCatalogApi(
  options: CreateCatalogApiOptions = {},
): CatalogApi {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  let cachedEtag: string | null = null;
  let cachedList: APIItem[] = [];

  return {
    async fetchCatalog(signal) {
      if (signal?.aborted) {
        throw abortError();
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (cachedEtag) {
        headers["If-None-Match"] = cachedEtag;
      }

      const targetUrl =
        options.baseUrl !== undefined
          ? `${options.baseUrl.replace(/\/+$/, "")}${CATALOG_PATH}`
          : apiUrl(CATALOG_PATH);

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
        return cachedList;
      }

      if (!response.ok) {
        throw new CatalogFetchError(
          "The marketplace service is unavailable right now.",
          response.status,
        );
      }

      const etag = response.headers.get("etag") ?? response.headers.get("ETag");
      if (etag) {
        cachedEtag = etag;
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
      cachedList = items;
      return items;
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
export async function fetchCatalog(signal?: AbortSignal): Promise<APIItem[]> {
  // No backend configured (static demo deployment): use the bundled sample
  // catalogue instead of firing a request that can only fail.
  if (!API_BASE) return MOCK_APIS;

  // When API_BASE is configured, errors must reject so the UI surfaces its
  // error or stale-data states rather than hiding failures behind mock data.
  return await catalogApi.fetchCatalog(signal);
}
