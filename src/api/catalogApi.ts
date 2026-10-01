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

import { API_BASE_URL } from "../config/constants";
import type { APIItem } from "../data/mockApis";

/** Path the marketplace catalogue is read from. */
export const CATALOG_PATH = "/v1/apis";

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

/**
 * Normalises the catalogue payload.
 *
 * The backend may answer with a bare array or wrap it (`{ data: [...] }` /
 * `{ apis: [...] }`); both are accepted so a response-shape change is a
 * one-line fix here rather than a page rewrite. Entries that are not objects
 * carrying the two fields the marketplace cannot render without (`id` and
 * `name`) are dropped instead of poisoning the list, so one malformed row does
 * not take the whole page down.
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

  return list.filter(
    (item): item is APIItem =>
      isRecord(item) && typeof item.id === "string" && typeof item.name === "string",
  );
}

/**
 * Creates a catalogue API. Tests inject a `fetchImpl`; app code uses the
 * shared {@link catalogApi} singleton.
 */
export function createCatalogApi(
  options: CreateCatalogApiOptions = {},
): CatalogApi {
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    async fetchCatalog(signal) {
      if (signal?.aborted) {
        throw abortError();
      }

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}${CATALOG_PATH}`, {
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

      return normalizeCatalog(payload);
    },
  };
}

/** Shared catalogue API used by the app. */
export const catalogApi: CatalogApi = createCatalogApi();

/**
 * Reads the marketplace catalogue.
 *
 * Exported as a standalone function (rather than only the singleton) so tests
 * can `vi.mock` this module with a single replacement and drive every
 * loading / success / failure path of the page.
 */
export function fetchCatalog(signal?: AbortSignal): Promise<APIItem[]> {
  return catalogApi.fetchCatalog(signal);
}
