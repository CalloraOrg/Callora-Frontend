/**
 * Route handler for GET /api/apis.
 *
 * Returns the catalogue of available APIs with support for
 * ETag-based conditional caching (strong validators).  Query
 * parameters allow filtering by category and status at the
 * boundary.
 *
 * Input validation
 * ────────────────────
 * • `category` — must be a non-empty string if provided
 * • `status`   — must be one of: operational, degraded, maintenance (case-insensitive)
 * • `search`   — non-empty string; matched against API name and description
 *
 * Standardized error envelope
 * ──────────────────────────────
 * All error responses follow the shape:
 * ```json
 * { "ok": false, "error": { "code": "...", "message": "..." } }
 * ```
 *
 * Success responses follow:
 * ```json
 * { "ok": true, "data": [...], "etag": "\"abc123...\"", "correlationId": "..." }
 * ```
 *
 * Structured logging
 * ──────────────────────
 * Every request is logged with a unique correlation ID via
 * `src/middleware/etag.ts`'s `log()` helper so request traces
 * are searchable across log aggregators.
 */

import { MOCK_APIS } from "../data/mockApis";
import type { APIItem } from "../data/mockApis";
import {
  applyETag,
  log,
  generateCorrelationId,
  checkETag,
  type LogLevel,
} from "../middleware/etag";

// ---------------------------------------------------------------------------
// Allowed query-parameter values
// ---------------------------------------------------------------------------

const ALLOWED_STATUSES = new Set(["operational", "degraded", "maintenance"]);

/** Parsed and validated query parameters for the /api/apis route. */
interface ApiQueryParams {
  category?: string;
  status?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Standardized error envelope
// ---------------------------------------------------------------------------

/** A shape that all error responses conform to. */
interface ErrorEnvelope {
  ok: false;
  error: { code: string; message: string };
}

/** A shape that all success responses conform to. */
interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  etag?: string;
  correlationId: string;
}

type ApiResponse<T> = SuccessEnvelope<T> | ErrorEnvelope;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate raw query parameters and return either a parsed object
 * or a standardized error envelope.
 *
 * Input validation at the boundary — the route handler rejects
 * malformed query params before any business logic runs.
 */
function validateParams(
  url: URL,
):
  | { type: "ok"; params: ApiQueryParams }
  | { type: "error"; error: ErrorEnvelope } {
  const category = url.searchParams.get("category") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  if (category !== undefined && category.trim().length === 0) {
    return {
      type: "error",
      error: {
        ok: false,
        error: {
          code: "INVALID_CATEGORY",
          message: "Category must be a non-empty string.",
        },
      },
    };
  }

  if (status !== undefined) {
    const normalized = status.toLowerCase();
    if (!ALLOWED_STATUSES.has(normalized)) {
      return {
        type: "error",
        error: {
          ok: false,
          error: {
            code: "INVALID_STATUS",
            message: `Status must be one of: ${[...ALLOWED_STATUSES].join(", ")}.`,
          },
        },
      };
    }
    return {
      type: "ok",
      params: {
        category: category?.trim(),
        status: normalized,
        search: search?.trim() || undefined,
      },
    };
  }

  return {
    type: "ok",
    params: {
      category: category?.trim(),
      status: undefined,
      search: search?.trim() || undefined,
    },
  };
}

/** Filter the mock API catalogue by validated query parameters. */
function filterApis(params: ApiQueryParams): APIItem[] {
  let results = [...MOCK_APIS];

  if (params.category) {
    results = results.filter(
      (api) => api.category?.toLowerCase() === params.category!.toLowerCase(),
    );
  }

  if (params.status) {
    results = results.filter((api) => api.status === params.status);
  }

  if (params.search) {
    const q = params.search.toLowerCase();
    results = results.filter(
      (api) =>
        api.name.toLowerCase().includes(q) ||
        api.description.toLowerCase().includes(q),
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle a GET request to /api/apis.
 *
 * Returns JSON with the filtered API catalogue, a strong ETag,
 * and a correlation ID for structured logging.  Responds with
 * 304 Not Modified when the client's If-None-Match matches the
 * current ETag.
 *
 * @param request - The incoming request (used for URL query params and headers).
 * @returns A `Response`--compatible object with status, headers, and body.
 */
export async function handleApisRoute(
  request:
    Request | { url: string; headers: Record<string, string | undefined> },
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const correlationId = generateCorrelationId();
  const url = new URL(request.url, "http://localhost");
  const searchParams = url.searchParams;

  // ── Input validation at the boundary ──────────────────────────────
  const validated = validateParams(url);
  if (validated.type === "error") {
    const body = JSON.stringify(validated.error);
    return {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body,
    };
  }

  const filters = validated.params;

  // ── Structured logging: request received ──────────────────────────
  const requestLog = log("info", "GET /api/apis received", correlationId, {
    query: Object.fromEntries(searchParams),
  });
  // In a real server this would go to stdout / a log aggregator.
  // Keeping it as a returned value for testability.
  void requestLog;

  // ── Apply ETag middleware (etag computed from resource body, not metadata) ──
  const data = filterApis(filters);
  const resourceBody = JSON.stringify({ ok: true, data });
  const headers: Record<string, string> = {};

  const status = await applyETag(
    resourceBody,
    request.headers["if-none-match"],
    headers,
  );

  // Correlation ID is added to the final body after ETag computation
  // so that ETags remain stable across requests for the same resource.
  const finalBody = JSON.stringify({
    ok: true,
    data,
    correlationId,
  });

  headers["Content-Type"] = "application/json";
  headers["X-Correlation-Id"] = correlationId;

  // ── Structured logging: response ─────────────────────────────────
  const responseLog = log(
    "info" as LogLevel,
    `GET /api/apis responded with status ${status}`,
    correlationId,
    { status, resultCount: data.length },
  );
  void responseLog;

  return { status, headers, body: finalBody };
}

export type { ApiQueryParams, ApiResponse, ErrorEnvelope, SuccessEnvelope };
