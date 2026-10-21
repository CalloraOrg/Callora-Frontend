/**
 * invoicesApi.ts
 *
 * Client module for fetching user invoices from Callora-Backend (`GET /api/invoices`).
 *
 * The backend endpoint accepts `limit` (1-100) and an optional base64 `cursor`,
 * and returns `{ data, meta }` ordered by `created_at` descending.
 *
 * Key responsibilities:
 * - Validates and normalises response payloads.
 * - Preserves `total_amount_usdc` as a raw decimal string (never passing through
 *   `parseFloat` so all 7 decimals of Stellar USDC precision remain exact).
 * - Coerces unknown status values to a safe fallback (`"unknown"`) so the UI
 *   renders a neutral badge instead of crashing.
 * - Uses the active account's API key (or an injected `fetchImpl`) and handles
 *   401 unauthorized responses distinctly from server/network errors.
 */

import { API_BASE, apiUrl } from "../config/constants";
import { getCurrentAccount } from "../state/accountStore";

/** Path the billing invoices endpoint is mounted at. */
export const INVOICES_PATH = "/api/invoices";

/** Known invoice statuses from Callora-Backend Prisma schema, plus safe unknown fallback. */
export type InvoiceStatus = "pending" | "paid" | "void" | "canceled" | "unknown";

const KNOWN_STATUSES = new Set<string>(["pending", "paid", "void", "canceled"]);

/** Normalised invoice record returned to UI consumers. */
export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  /** Raw status string from backend before normalisation. */
  rawStatus: string;
  /** Exact decimal string from backend (e.g. "12.3456789"). Never parsed with parseFloat. */
  totalAmountUsdc: string;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
}

export interface InvoicesMeta {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FetchInvoicesResponse {
  data: InvoiceItem[];
  meta: InvoicesMeta;
}

export interface FetchLatestInvoicesOptions {
  /** Number of invoices to request (1-100, default 20). */
  limit?: number;
  /** Optional pagination cursor. */
  cursor?: string;
  /** AbortSignal to cancel the in-flight request on unmount or account change. */
  signal?: AbortSignal;
  /** Base URL override (defaults to API_BASE). */
  baseUrl?: string;
  /** Injectable fetch implementation for tests or custom auth wrappers. */
  fetchImpl?: typeof fetch;
}

/** Raised when `/api/invoices` returns a non-OK response or invalid payload. */
export class InvoicesFetchError extends Error {
  public readonly status: number | null;
  public readonly code: "UNAUTHORIZED" | "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_RESPONSE";

  constructor(
    message: string,
    status: number | null = null,
    code: InvoicesFetchError["code"] = "HTTP_ERROR",
  ) {
    super(message);
    this.name = "InvoicesFetchError";
    this.status = status;
    this.code = code;
  }
}

/** Predicate to check if an error is an AbortError. */
export function isInvoicesAbortError(err: unknown): boolean {
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
 * Normalise a raw status string into a known `InvoiceStatus` or `"unknown"`.
 */
export function normalizeInvoiceStatus(status: unknown): InvoiceStatus {
  if (typeof status !== "string") return "unknown";
  const normalized = status.trim().toLowerCase();
  if (KNOWN_STATUSES.has(normalized)) {
    return normalized as InvoiceStatus;
  }
  return "unknown";
}

/**
 * Adapt a single backend invoice row into an `InvoiceItem`.
 * Throws `InvoicesFetchError` if required fields (`invoice_number`, `total_amount_usdc`)
 * are missing or invalid.
 */
export function adaptBackendInvoice(row: unknown): InvoiceItem {
  if (!isRecord(row)) {
    throw new InvoicesFetchError(
      "Invoice entry is not an object.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const rawInvoiceNumber = row.invoice_number ?? row.invoiceNumber;
  if (typeof rawInvoiceNumber !== "string" || !rawInvoiceNumber.trim()) {
    throw new InvoicesFetchError(
      "Invoice entry is missing a valid invoice_number.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const rawTotalAmount = row.total_amount_usdc ?? row.totalAmountUsdc;
  if (typeof rawTotalAmount !== "string" || !/^\s*-?\d+(?:\.\d+)?\s*$/.test(rawTotalAmount)) {
    throw new InvoicesFetchError(
      "Invoice entry is missing a valid total_amount_usdc decimal string.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const id =
    row.id !== undefined && row.id !== null && String(row.id).trim() !== ""
      ? String(row.id).trim()
      : rawInvoiceNumber.trim();

  const rawStatusStr = typeof row.status === "string" ? row.status.trim() : "";
  const status = normalizeInvoiceStatus(row.status);

  const currency =
    typeof row.currency === "string" && row.currency.trim() !== ""
      ? row.currency.trim()
      : "USDC";

  const periodStart =
    typeof row.period_start === "string"
      ? row.period_start
      : typeof row.periodStart === "string"
        ? row.periodStart
        : undefined;

  const periodEnd =
    typeof row.period_end === "string"
      ? row.period_end
      : typeof row.periodEnd === "string"
        ? row.periodEnd
        : undefined;

  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : typeof row.createdAt === "string"
        ? row.createdAt
        : undefined;

  return {
    id,
    invoiceNumber: rawInvoiceNumber.trim(),
    status,
    rawStatus: rawStatusStr,
    totalAmountUsdc: rawTotalAmount.trim(),
    currency,
    periodStart,
    periodEnd,
    createdAt,
  };
}

/**
 * Validate and normalise the `{ data, meta }` response payload from `GET /api/invoices`.
 */
export function validateInvoicesResponse(payload: unknown): FetchInvoicesResponse {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new InvoicesFetchError(
      "Invalid invoices response shape: expected { data: [...] }.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const data = payload.data.map((item) => adaptBackendInvoice(item));

  const rawMeta = isRecord(payload.meta) ? payload.meta : {};
  const limit = typeof rawMeta.limit === "number" ? rawMeta.limit : data.length;
  const nextCursor = typeof rawMeta.nextCursor === "string" ? rawMeta.nextCursor : null;
  const hasMore = typeof rawMeta.hasMore === "boolean" ? rawMeta.hasMore : false;

  return {
    data,
    meta: {
      limit,
      nextCursor,
      hasMore,
    },
  };
}

/**
 * Pick the newest pending invoice from an ordered list of invoices.
 * Callora-Backend returns invoices ordered by `created_at` desc, so the first
 * invoice with `status === "pending"` is the most recent open invoice.
 */
export function selectNewestPendingInvoice(invoices: readonly InvoiceItem[]): InvoiceItem | null {
  for (const inv of invoices) {
    if (inv.status === "pending") {
      return inv;
    }
  }
  return null;
}

/**
 * Shared authenticated fetch helper. Attaches `Accept: application/json`,
 * `credentials: "include"`, and the active account's `Authorization: Bearer <apiKey>`
 * header when an account is active.
 */
export function getSharedAuthenticatedFetch(baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
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

/**
 * Fetch the latest invoices for the authenticated user from `GET /api/invoices`.
 */
export async function fetchLatestInvoices(
  options: FetchLatestInvoicesOptions = {},
): Promise<FetchInvoicesResponse> {
  const { limit = 20, cursor, signal, baseUrl, fetchImpl } = options;

  if (signal?.aborted) {
    throw abortError();
  }

  const clampedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const params = new URLSearchParams({ limit: String(clampedLimit) });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const pathWithQuery = `${INVOICES_PATH}?${params.toString()}`;
  const targetUrl =
    baseUrl !== undefined
      ? `${baseUrl.replace(/\/+$/, "")}${pathWithQuery}`
      : apiUrl(pathWithQuery);

  const effectiveFetch = fetchImpl ?? getSharedAuthenticatedFetch(globalThis.fetch);

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
    if (signal?.aborted || isInvoicesAbortError(err)) {
      throw abortError();
    }
    throw new InvoicesFetchError(
      "Could not reach the billing service. Check your connection and try again.",
      null,
      "NETWORK_ERROR",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  if (response.status === 401) {
    throw new InvoicesFetchError(
      "Sign in to view your latest invoices.",
      401,
      "UNAUTHORIZED",
    );
  }

  if (!response.ok) {
    throw new InvoicesFetchError(
      "Could not load your latest invoice. Please try again.",
      response.status,
      "HTTP_ERROR",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    if (signal?.aborted || isInvoicesAbortError(err)) {
      throw abortError();
    }
    throw new InvoicesFetchError(
      "The billing service returned an unreadable response.",
      response.status,
      "INVALID_RESPONSE",
    );
  }

  if (signal?.aborted) {
    throw abortError();
  }

  return validateInvoicesResponse(payload);
}

/** Clearly labelled demo invoice used when no backend (`VITE_API_BASE_URL`) is configured. */
export const DEMO_INVOICE: InvoiceItem = {
  id: "demo-invoice",
  invoiceNumber: "DEMO-INV-001",
  status: "pending",
  rawStatus: "pending",
  totalAmountUsdc: "42.5000000",
  currency: "USDC",
  periodStart: "2026-08-01T00:00:00Z",
  periodEnd: "2026-09-01T00:00:00Z",
};

/** Whether the app is running in static demo mode (no `VITE_API_BASE_URL` configured). */
export function isInvoiceDemoMode(): boolean {
  return !API_BASE;
}
