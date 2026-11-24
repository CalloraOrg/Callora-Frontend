/**
 * Shared typed HTTP client for Callora.
 *
 * Combines base URL resolution (`apiUrl`), authenticated
 * fetch (`authFetch` with single-flight 401 refresh), request timeouts
 * (`runWithTimeout`), `AbortSignal` passthrough, query-string encoding,
 * safe JSON/204 parsing, optional response validation (`parse`), and
 * classified `ApiError` instances built with `classifyHttpError`.
 */

import { apiUrl } from "../config/constants";
import { authFetch } from "../services/authFetch";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  runWithTimeout,
} from "../services/idempotency";
import {
  classifyHttpError,
  redactSensitiveData,
} from "../services/SecureErrorHandler";

export type QueryParamValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions<T = unknown> {
  /** Query parameters appended to `path`; null/undefined values are omitted. */
  query?: Record<string, QueryParamValue>;
  /** Request body; plain objects are JSON-serialised with Content-Type: application/json. */
  body?: unknown;
  /** Additional request headers. */
  headers?: HeadersInit;
  /** Caller AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds (defaults to DEFAULT_REQUEST_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Whether to route through `authFetch` (default: true). Set false for public endpoints. */
  auth?: boolean;
  /** Optional response validator/normaliser invoked with the parsed JSON payload. */
  parse?: (raw: unknown) => T;
  /** Optional base URL override (trailing slashes trimmed). */
  baseUrl?: string;
  /** Optional custom fetch implementation (primarily for tests or custom transports). */
  fetchImpl?: typeof fetch;
  /** Optional hook invoked with the raw Response on 2xx responses. */
  onResponse?: (response: Response) => void;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly data?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      retryable: boolean;
      data?: unknown;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
    this.data = options.data;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function isApiAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function createAbortError(message = "The operation was aborted."): Error {
  if (typeof DOMException === "function") {
    return new DOMException(message, "AbortError");
  }
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}

function buildPathWithQuery(
  path: string,
  query?: Record<string, QueryParamValue>,
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!query) return normalized;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  if (!qs) return normalized;
  return normalized.includes("?") ? `${normalized}&${qs}` : `${normalized}?${qs}`;
}

function resolveTargetUrl(pathWithQuery: string, baseUrl?: string): string {
  if (baseUrl !== undefined) {
    const cleanBase = baseUrl.trim().replace(/\/+$/, "");
    return cleanBase ? `${cleanBase}${pathWithQuery}` : pathWithQuery;
  }
  return apiUrl(pathWithQuery);
}

function combineAbortSignals(
  callerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  if (!callerSignal) {
    return { signal: timeoutSignal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const onCallerAbort = () => controller.abort(callerSignal.reason);
  const onTimeoutAbort = () => controller.abort(timeoutSignal.reason);

  if (callerSignal.aborted) {
    controller.abort(callerSignal.reason);
  } else if (timeoutSignal.aborted) {
    controller.abort(timeoutSignal.reason);
  } else {
    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    timeoutSignal.addEventListener("abort", onTimeoutAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      callerSignal.removeEventListener("abort", onCallerAbort);
      timeoutSignal.removeEventListener("abort", onTimeoutAbort);
    },
  };
}

function isBodyInitLike(value: unknown): value is BodyInit {
  if (typeof value === "string") return true;
  if (typeof FormData !== "undefined" && value instanceof FormData) return true;
  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return true;
  return ArrayBuffer.isView(value);
}

function defaultCodeForStatus(status: number, category: string): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (category === "server_error") return "SERVER_ERROR";
  if (category === "client_error") return "CLIENT_ERROR";
  return "HTTP_ERROR";
}

function extractErrorMeta(
  payload: unknown,
  status: number,
): { code: string; message: string; retryable: boolean } {
  const classification = classifyHttpError(status);
  let code = defaultCodeForStatus(status, classification.category);
  let rawMessage = `Request failed with status ${status}`;

  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    const nested =
      typeof record.error === "object" && record.error !== null
        ? (record.error as Record<string, unknown>)
        : null;

    const extractedCode = nested?.code ?? record.code;
    if (typeof extractedCode === "string" && extractedCode.trim()) {
      code = extractedCode.trim();
    }

    const extractedMsg = nested?.message ?? record.message;
    if (typeof extractedMsg === "string" && extractedMsg.trim()) {
      rawMessage = extractedMsg;
    }
  }

  return {
    code,
    message: redactSensitiveData(rawMessage),
    retryable: classification.retryable,
  };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  if (typeof response.text === "function") {
    const text = await response.text();
    if (!text.trim()) {
      return undefined;
    }
    return JSON.parse(text) as unknown;
  }

  if (typeof response.json === "function") {
    return (await response.json()) as unknown;
  }

  return undefined;
}

function normalizeHeaders(rawHeaders?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!rawHeaders) return result;
  if (rawHeaders instanceof Headers) {
    rawHeaders.forEach((value, key) => {
      result[key] = value;
    });
  } else if (Array.isArray(rawHeaders)) {
    for (const [key, value] of rawHeaders) {
      result[key] = value;
    }
  } else {
    Object.assign(result, rawHeaders);
  }
  return result;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: ApiRequestOptions<T> = {},
): Promise<T> {
  const {
    query,
    body,
    headers: rawHeaders,
    signal: callerSignal,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    auth = true,
    parse,
    baseUrl,
    fetchImpl,
    onResponse,
  } = options;

  if (callerSignal?.aborted) {
    throw createAbortError();
  }

  const pathWithQuery = buildPathWithQuery(path, query);
  const headers = normalizeHeaders(rawHeaders);
  if (method === "GET" && !hasHeader(headers, "Accept")) {
    headers["Accept"] = "application/json";
  }

  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isBodyInitLike(body)) {
      serializedBody = body;
    } else {
      serializedBody = JSON.stringify(body);
      if (!hasHeader(headers, "Content-Type")) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const execute = async (timeoutSignal: AbortSignal): Promise<Response> => {
    const { signal, cleanup } = combineAbortSignals(callerSignal, timeoutSignal);
    const init: RequestInit = {
      method,
      headers,
      signal,
      ...(serializedBody !== undefined ? { body: serializedBody } : {}),
    };

    try {
      if (fetchImpl) {
        return await fetchImpl(resolveTargetUrl(pathWithQuery, baseUrl), init);
      }
      if (!auth || baseUrl !== undefined) {
        return await globalThis.fetch(resolveTargetUrl(pathWithQuery, baseUrl), init);
      }
      return await authFetch(pathWithQuery, init);
    } catch (err) {
      if (callerSignal?.aborted || isApiAbortError(err)) {
        throw createAbortError();
      }
      throw new ApiError("Network request failed.", {
        status: 0,
        code: "NETWORK_ERROR",
        retryable: true,
      });
    } finally {
      cleanup();
    }
  };

  const response = await runWithTimeout(execute, timeoutMs);

  if (callerSignal?.aborted) {
    throw createAbortError();
  }

  if (!response.ok) {
    let errorPayload: unknown;
    try {
      errorPayload = await parseResponseBody(response);
    } catch {
      errorPayload = undefined;
    }
    const meta = extractErrorMeta(errorPayload, response.status);
    throw new ApiError(meta.message, {
      status: response.status,
      code: meta.code,
      retryable: meta.retryable,
      data: errorPayload,
    });
  }

  onResponse?.(response);

  let parsedPayload: unknown;
  try {
    parsedPayload = await parseResponseBody(response);
  } catch (err) {
    if (callerSignal?.aborted || isApiAbortError(err)) {
      throw createAbortError();
    }
    throw new ApiError("Response body is not valid JSON.", {
      status: response.status,
      code: "INVALID_RESPONSE",
      retryable: false,
    });
  }

  if (callerSignal?.aborted) {
    throw createAbortError();
  }

  return parse ? parse(parsedPayload) : (parsedPayload as T);
}

export const apiClient = {
  request,
  get<T>(path: string, options?: ApiRequestOptions<T>): Promise<T> {
    return request<T>("GET", path, options);
  },
  post<T>(path: string, options?: ApiRequestOptions<T>): Promise<T> {
    return request<T>("POST", path, options);
  },
  put<T>(path: string, options?: ApiRequestOptions<T>): Promise<T> {
    return request<T>("PUT", path, options);
  },
  delete<T>(path: string, options?: ApiRequestOptions<T>): Promise<T> {
    return request<T>("DELETE", path, options);
  },
};
