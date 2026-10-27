/**
 * subscriptionsApi.ts
 *
 * Client module for managing API subscriptions via Callora-Backend
 * (`/api/subscriptions`).
 *
 * Endpoints:
 * - `GET /api/subscriptions?status=active`: Lists subscriptions for current user.
 * - `POST /api/subscriptions`: Creates a subscription ({ api_id: string }).
 *   Carries an `Idempotency-Key` header generated via `generateIdempotencyKey`.
 * - `DELETE /api/subscriptions/:id`: Cancels / deletes a subscription.
 *
 * All endpoints require authentication.
 */

import { API_BASE, apiUrl } from "../config/constants";
import { getCurrentAccount } from "../state/accountStore";
import { generateIdempotencyKey } from "../services/idempotency";

/** Path the subscriptions endpoint is mounted at. */
export const SUBSCRIPTIONS_PATH = "/api/subscriptions";

export type SubscriptionStatus = "active" | "paused" | "cancelled" | "unknown";

export interface SubscriptionItem {
  id: string;
  apiId: string;
  status: SubscriptionStatus;
  rawStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ListSubscriptionsOptions {
  /** Optional status filter (default: "active") */
  status?: string;
  /** AbortSignal to cancel the in-flight request */
  signal?: AbortSignal;
  /** Base URL override (defaults to API_BASE). */
  baseUrl?: string;
  /** Injectable fetch implementation for tests */
  fetchImpl?: typeof fetch;
}

export interface SubscribeOptions {
  /** Optional custom idempotency key; auto-generated if not provided */
  idempotencyKey?: string;
  /** AbortSignal to cancel in-flight request */
  signal?: AbortSignal;
  /** Base URL override (defaults to API_BASE). */
  baseUrl?: string;
  /** Injectable fetch implementation for tests */
  fetchImpl?: typeof fetch;
}

export interface UnsubscribeOptions {
  /** AbortSignal to cancel in-flight request */
  signal?: AbortSignal;
  /** Base URL override (defaults to API_BASE). */
  baseUrl?: string;
  /** Injectable fetch implementation for tests */
  fetchImpl?: typeof fetch;
}

export class SubscriptionsApiError extends Error {
  public readonly status: number | null;
  public readonly code:
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "CONFLICT"
    | "HTTP_ERROR"
    | "NETWORK_ERROR"
    | "INVALID_RESPONSE";

  constructor(
    message: string,
    status: number | null = null,
    code: SubscriptionsApiError["code"] = "HTTP_ERROR",
  ) {
    super(message);
    name: "SubscriptionsApiError";
    this.name = "SubscriptionsApiError";
    this.status = status;
    this.code = code;
  }
}

export function isSubscriptionsAbortError(err: unknown): boolean {
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

export function normalizeSubscriptionStatus(status: unknown): SubscriptionStatus {
  if (typeof status !== "string") return "unknown";
  const s = status.trim().toLowerCase();
  if (s === "active" || s === "paused" || s === "cancelled") {
    return s as SubscriptionStatus;
  }
  return "unknown";
}

export function adaptBackendSubscription(row: unknown): SubscriptionItem {
  if (!isRecord(row)) {
    throw new SubscriptionsApiError(
      "Subscription entry is not an object.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const id = row.id !== undefined && row.id !== null ? String(row.id).trim() : "";
  if (!id) {
    throw new SubscriptionsApiError(
      "Subscription entry is missing an id.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const rawApiId = row.api_id ?? row.apiId;
  const apiId = rawApiId !== undefined && rawApiId !== null ? String(rawApiId).trim() : "";
  if (!apiId) {
    throw new SubscriptionsApiError(
      "Subscription entry is missing api_id.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const status = normalizeSubscriptionStatus(row.status);
  const rawStatus = typeof row.status === "string" ? row.status.trim() : undefined;
  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : typeof row.createdAt === "string"
        ? row.createdAt
        : undefined;
  const updatedAt =
    typeof row.updated_at === "string"
      ? row.updated_at
      : typeof row.updatedAt === "string"
        ? row.updatedAt
        : undefined;

  return {
    ...row,
    id,
    apiId,
    status,
    rawStatus,
    createdAt,
    updatedAt,
  };
}

export function validateSubscriptionsListResponse(payload: unknown): SubscriptionItem[] {
  let list: unknown[] | null = null;
  if (Array.isArray(payload)) {
    list = payload;
  } else if (isRecord(payload) && Array.isArray(payload.data)) {
    list = payload.data;
  } else if (isRecord(payload) && Array.isArray(payload.subscriptions)) {
    list = payload.subscriptions;
  }

  if (!list) {
    throw new SubscriptionsApiError(
      "Invalid subscriptions response: expected an array or { data: [...] }.",
      null,
      "INVALID_RESPONSE",
    );
  }

  return list.map((item) => adaptBackendSubscription(item));
}

export function validateSubscriptionResponse(payload: unknown): SubscriptionItem {
  if (isRecord(payload) && isRecord(payload.data)) {
    return adaptBackendSubscription(payload.data);
  }
  if (isRecord(payload) && isRecord(payload.subscription)) {
    return adaptBackendSubscription(payload.subscription);
  }
  return adaptBackendSubscription(payload);
}

export function getSharedAuthenticatedFetch(
  baseFetch: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const account = getCurrentAccount();
    const headers = new Headers(init?.headers);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }
    if (account?.apiKey && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${account.apiKey}`);
    }
    return baseFetch(input, {
      ...init,
      headers,
      credentials: init?.credentials ?? "include",
    });
  };
}

export function isSubscriptionsDemoMode(): boolean {
  return !API_BASE;
}

/**
 * List active subscriptions for the authenticated user (`GET /api/subscriptions?status=active`).
 */
export async function listActive(
  options: ListSubscriptionsOptions = {},
): Promise<SubscriptionItem[]> {
  const { status = "active", signal, baseUrl, fetchImpl } = options;

  if (signal?.aborted) {
    throw abortError();
  }

  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const pathWithQuery = `${SUBSCRIPTIONS_PATH}${query}`;
  const targetUrl =
    baseUrl !== undefined
      ? `${baseUrl.replace(/\/+$/, "")}${pathWithQuery}`
      : apiUrl(pathWithQuery);

  const effectiveFetch = fetchImpl
    ? getSharedAuthenticatedFetch(fetchImpl)
    : getSharedAuthenticatedFetch(globalThis.fetch);

  let response: Response;
  try {
    response = await effectiveFetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    });
  } catch (err) {
    if (signal?.aborted || isSubscriptionsAbortError(err)) {
      throw abortError();
    }
    throw new SubscriptionsApiError(
      "Could not reach the subscriptions service. Check your connection and try again.",
      null,
      "NETWORK_ERROR",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  if (response.status === 401) {
    throw new SubscriptionsApiError(
      "Sign in to view your subscriptions.",
      401,
      "UNAUTHORIZED",
    );
  }

  if (!response.ok) {
    throw new SubscriptionsApiError(
      "Could not load subscriptions. Please try again.",
      response.status,
      "HTTP_ERROR",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    if (signal?.aborted || isSubscriptionsAbortError(err)) {
      throw abortError();
    }
    throw new SubscriptionsApiError(
      "The subscriptions service returned an unreadable response.",
      response.status,
      "INVALID_RESPONSE",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  return validateSubscriptionsListResponse(payload);
}

/**
 * Subscribe to an API (`POST /api/subscriptions` with { api_id }).
 * Sends Idempotency-Key header.
 */
export async function subscribe(
  apiId: string,
  options: SubscribeOptions = {},
): Promise<SubscriptionItem> {
  const { idempotencyKey, signal, baseUrl, fetchImpl } = options;

  if (!apiId || !apiId.trim()) {
    throw new SubscriptionsApiError("apiId is required to subscribe.", null, "INVALID_RESPONSE");
  }

  if (signal?.aborted) {
    throw abortError();
  }

  const targetUrl =
    baseUrl !== undefined
      ? `${baseUrl.replace(/\/+$/, "")}${SUBSCRIPTIONS_PATH}`
      : apiUrl(SUBSCRIPTIONS_PATH);

  const effectiveFetch = fetchImpl
    ? getSharedAuthenticatedFetch(fetchImpl)
    : getSharedAuthenticatedFetch(globalThis.fetch);
  const key = idempotencyKey || generateIdempotencyKey();

  let response: Response;
  try {
    response = await effectiveFetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ api_id: apiId.trim() }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted || isSubscriptionsAbortError(err)) {
      throw abortError();
    }
    throw new SubscriptionsApiError(
      "Could not reach the subscriptions service. Check your connection and try again.",
      null,
      "NETWORK_ERROR",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  if (response.status === 401) {
    throw new SubscriptionsApiError(
      "Sign in to subscribe to this API.",
      401,
      "UNAUTHORIZED",
    );
  }

  if (response.status === 409) {
    throw new SubscriptionsApiError(
      "Already subscribed to this API.",
      409,
      "CONFLICT",
    );
  }

  if (response.status === 404) {
    throw new SubscriptionsApiError(
      "API not found or no longer available.",
      404,
      "NOT_FOUND",
    );
  }

  if (!response.ok) {
    let errMsg = "Could not subscribe to API. Please try again.";
    try {
      const errBody = (await response.json()) as { message?: string; error?: string };
      if (errBody?.message) errMsg = errBody.message;
      else if (errBody?.error) errMsg = errBody.error;
    } catch {
      // ignore
    }
    throw new SubscriptionsApiError(errMsg, response.status, "HTTP_ERROR");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    if (signal?.aborted || isSubscriptionsAbortError(err)) {
      throw abortError();
    }
    throw new SubscriptionsApiError(
      "The subscriptions service returned an unreadable response.",
      response.status,
      "INVALID_RESPONSE",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  return validateSubscriptionResponse(payload);
}

/**
 * Unsubscribe from a subscription (`DELETE /api/subscriptions/:id`).
 */
export async function unsubscribe(
  subscriptionId: string,
  options: UnsubscribeOptions = {},
): Promise<void> {
  const { signal, baseUrl, fetchImpl } = options;

  if (!subscriptionId || !subscriptionId.trim()) {
    throw new SubscriptionsApiError(
      "subscriptionId is required to unsubscribe.",
      null,
      "INVALID_RESPONSE",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  const path = `${SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId.trim())}`;
  const targetUrl =
    baseUrl !== undefined
      ? `${baseUrl.replace(/\/+$/, "")}${path}`
      : apiUrl(path);

  const effectiveFetch = fetchImpl
    ? getSharedAuthenticatedFetch(fetchImpl)
    : getSharedAuthenticatedFetch(globalThis.fetch);

  let response: Response;
  try {
    response = await effectiveFetch(targetUrl, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
      signal,
    });
  } catch (err) {
    if (signal?.aborted || isSubscriptionsAbortError(err)) {
      throw abortError();
    }
    throw new SubscriptionsApiError(
      "Could not reach the subscriptions service. Check your connection and try again.",
      null,
      "NETWORK_ERROR",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  if (response.status === 401) {
    throw new SubscriptionsApiError(
      "Sign in to manage your subscriptions.",
      401,
      "UNAUTHORIZED",
    );
  }

  if (response.status === 404) {
    throw new SubscriptionsApiError(
      "Subscription not found.",
      404,
      "NOT_FOUND",
    );
  }

  if (!response.ok) {
    let errMsg = "Could not unsubscribe. Please try again.";
    try {
      const errBody = (await response.json()) as { message?: string; error?: string };
      if (errBody?.message) errMsg = errBody.message;
      else if (errBody?.error) errMsg = errBody.error;
    } catch {
      // ignore
    }
    throw new SubscriptionsApiError(errMsg, response.status, "HTTP_ERROR");
  }
}
