/**
 * quotaApi.ts
 *
 * Simulated, backend-shaped quota API used by the race-safe quota store.
 *
 * The API models a real server with a per-account authoritative record that
 * carries a monotonically increasing `version`. Optimistic clients must submit
 * their update together with the `version` they based it on (the
 * "base version"); if that base is stale (another update already landed), the
 * server rejects with {@link QuotaConflictError}. This is exactly the failure
 * mode the store must handle across concurrent requests and tabs.
 *
 * Every call accepts an optional `AbortSignal` so in-flight requests can be
 * cancelled when a newer request supersedes them or the user switches account.
 */

import { authFetch } from "../services/authFetch";
import { classifyHttpError } from "../services/SecureErrorHandler";

export interface QuotaRecord {
  accountId: string;
  /** Authoritative quota value (e.g. requests-per-window). */
  value: number;
  /** Server version; bumped on every successful mutation. */
  version: number;
  /** Server timestamp of the last authoritative change. */
  updatedAt: number;
}

/** Raised when an update is based on a stale server version. */
export class QuotaConflictError extends Error {
  public readonly serverVersion: number;

  constructor(serverVersion: number, accountId: string) {
    super(
      `Quota update rejected: a newer version (v${serverVersion}) already exists for "${accountId}".`,
    );
    this.name = "QuotaConflictError";
    this.serverVersion = serverVersion;
  }
}

export interface QuotaApi {
  fetchQuota(accountId: string, signal?: AbortSignal): Promise<QuotaRecord>;
  updateQuota(
    accountId: string,
    value: number,
    baseVersion: number,
    signal?: AbortSignal,
  ): Promise<QuotaRecord>;
}

export interface CreateQuotaApiOptions {
  /** Base artificial latency (ms) applied to every request. */
  latencyMs?: number;
  /** Seed values keyed by accountId. Missing accounts default to value 0. */
  initial?: Record<string, number>;
}

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function delay(latencyMs: number, signal?: AbortSignal): Promise<void> {
  if (latencyMs <= 0) {
    return signal?.aborted ? Promise.reject(abortError()) : Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, latencyMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

/**
 * Creates an in-memory quota API. Two store instances that share the same
 * `QuotaApi` therefore share the same "server", which is how cross-tab
 * consistency is exercised in tests.
 */
export function createQuotaApi(
  options: CreateQuotaApiOptions = {},
): QuotaApi {
  const latency = options.latencyMs ?? 0;
  const server = new Map<string, QuotaRecord>();

  for (const [accountId, value] of Object.entries(options.initial ?? {})) {
    server.set(accountId, {
      accountId,
      value,
      version: 1,
      updatedAt: Date.now(),
    });
  }

  function readOrInit(accountId: string): QuotaRecord {
    let rec = server.get(accountId);
    if (!rec) {
      rec = { accountId, value: 0, version: 1, updatedAt: Date.now() };
      server.set(accountId, rec);
    }
    return rec;
  }

  return {
    async fetchQuota(accountId, signal) {
      await delay(latency, signal);
      const rec = readOrInit(accountId);
      return { ...rec };
    },

    async updateQuota(accountId, value, baseVersion, signal) {
      await delay(latency, signal);
      const current = readOrInit(accountId);
      if (baseVersion !== current.version) {
        throw new QuotaConflictError(current.version, accountId);
      }
      const next: QuotaRecord = {
        accountId,
        value,
        version: current.version + 1,
        updatedAt: Date.now(),
      };
      server.set(accountId, next);
      return { ...next };
    },
  };
}

export type QuotaHttpErrorCategory = ReturnType<
  typeof classifyHttpError
>["category"];

/** Typed HTTP error raised by {@link createHttpQuotaApi} for non-409 failures. */
export class QuotaHttpError extends Error {
  public readonly status: number;
  public readonly category: QuotaHttpErrorCategory;
  public readonly retryable: boolean;

  constructor(status: number, message?: string) {
    const { category, retryable } = classifyHttpError(status);
    super(message ?? defaultHttpErrorMessage(status));
    this.name = "QuotaHttpError";
    this.status = status;
    this.category = category;
    this.retryable = retryable;
  }
}

/** Raised when the quota endpoint returns malformed JSON or an invalid record shape. */
export class QuotaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaValidationError";
  }
}

export interface CreateHttpQuotaApiOptions {
  /** Authenticated fetch implementation. Defaults to {@link authFetch}. */
  fetchImpl?: typeof authFetch;
}

function defaultHttpErrorMessage(status: number): string {
  if (status === 401) return "Authentication required to access quota.";
  if (status === 403) return "You do not have permission to access this quota.";
  if (status === 429) return "Too many quota requests. Please try again later.";
  if (status >= 500 && status < 600) {
    return "Quota service is temporarily unavailable.";
  }
  return `Quota request failed (HTTP ${status}).`;
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "AbortError"
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseQuotaRecord(payload: unknown): QuotaRecord {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new QuotaValidationError("Invalid quota response payload.");
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.accountId !== "string" || record.accountId.trim() === "") {
    throw new QuotaValidationError("Quota response missing valid accountId.");
  }
  if (typeof record.value !== "number" || !Number.isFinite(record.value)) {
    throw new QuotaValidationError("Quota response missing finite numeric value.");
  }
  if (!isNonNegativeInteger(record.version)) {
    throw new QuotaValidationError(
      "Quota response missing non-negative integer version.",
    );
  }
  if (
    typeof record.updatedAt !== "number" ||
    !Number.isFinite(record.updatedAt)
  ) {
    throw new QuotaValidationError(
      "Quota response missing finite numeric updatedAt.",
    );
  }

  return {
    accountId: record.accountId,
    value: record.value,
    version: record.version,
    updatedAt: record.updatedAt,
  };
}

function parseVersionFromEtag(etag: string | null): number | null {
  if (!etag) return null;
  const cleaned = etag.trim().replace(/^W\//i, "").replace(/^"|"$/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return isNonNegativeInteger(parsed) ? parsed : null;
}

async function extractConflictVersion(
  response: Response,
  fallbackVersion: number,
): Promise<number> {
  try {
    const body = (await response.json()) as Record<string, unknown> | null;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const candidates: unknown[] = [
        body.serverVersion,
        body.version,
        body.currentVersion,
        (body.record as Record<string, unknown> | undefined)?.version,
      ];
      for (const candidate of candidates) {
        if (isNonNegativeInteger(candidate)) {
          return candidate;
        }
      }
    }
  } catch (err) {
    if (isAbortError(err)) throw err;
    // Ignore non-JSON 409 bodies and fall through to ETag / fallback.
  }

  const etagHeader =
    response.headers && typeof response.headers.get === "function"
      ? response.headers.get("ETag")
      : null;
  const etagVersion = parseVersionFromEtag(etagHeader);
  if (etagVersion !== null) {
    return etagVersion;
  }

  return fallbackVersion;
}

async function parseJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new QuotaValidationError("Malformed JSON in quota response.");
  }
}

/**
 * Creates an HTTP-backed {@link QuotaApi} using {@link authFetch}.
 *
 * Assumed backend contract:
 *  - `GET /api/quota?accountId=<id>` -> `200 OK` with JSON {@link QuotaRecord}
 *    `{ accountId: string, value: number, version: integer >= 0, updatedAt: number }`.
 *  - `PUT /api/quota` with JSON `{ accountId, value, baseVersion }` ->
 *    `200 OK` with updated {@link QuotaRecord}.
 *  - `409 Conflict` on stale `baseVersion` -> JSON body containing an integer
 *    `serverVersion`, `version`, `currentVersion`, or `record.version` (or an
 *    integer `ETag` header such as `"4"` / `W/"4"`), mapped to
 *    {@link QuotaConflictError}.
 *  - Other non-2xx responses (401/403/5xx, etc.) are classified via
 *    {@link classifyHttpError} and thrown as {@link QuotaHttpError}.
 *  - `AbortError` is propagated unchanged so callers can ignore cancelled requests.
 */
export function createHttpQuotaApi(
  options: CreateHttpQuotaApiOptions = {},
): QuotaApi {
  const fetchImpl = options.fetchImpl ?? authFetch;

  return {
    async fetchQuota(accountId, signal) {
      if (signal?.aborted) {
        throw abortError();
      }
      const path = `/api/quota?accountId=${encodeURIComponent(accountId)}`;
      const response = await fetchImpl(path, {
        method: "GET",
        signal,
      });

      if (!response.ok) {
        throw new QuotaHttpError(response.status);
      }

      const payload = await parseJsonPayload(response);
      return parseQuotaRecord(payload);
    },

    async updateQuota(accountId, value, baseVersion, signal) {
      if (signal?.aborted) {
        throw abortError();
      }
      const response = await fetchImpl("/api/quota", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, value, baseVersion }),
        signal,
      });

      if (response.status === 409) {
        const serverVersion = await extractConflictVersion(
          response,
          baseVersion,
        );
        throw new QuotaConflictError(serverVersion, accountId);
      }

      if (!response.ok) {
        throw new QuotaHttpError(response.status);
      }

      const payload = await parseJsonPayload(response);
      return parseQuotaRecord(payload);
    },
  };
}
