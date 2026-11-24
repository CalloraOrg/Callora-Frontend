import { authFetch } from "./authFetch";
import { classifyHttpError, getSafeErrorMessage } from "./SecureErrorHandler";

/**
 * Response header used by the gateway to report the cost of a test call in USDC.
 * Falls back to 0 when absent or unparseable.
 */
export const COST_HEADER = "X-Callora-Cost";

export interface TestCallEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
}

export interface RunTestCallOptions {
  endpoint: TestCallEndpoint;
  params: string;
  signal?: AbortSignal;
}

export interface TestCallResult {
  ok: boolean;
  status: "success" | "error";
  httpStatus: number | null;
  responseTime: number;
  cost: number;
  body: unknown;
  errorMessage?: string;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

function buildPathWithQuery(path: string, params: string): string {
  const trimmed = params.trim();
  if (!trimmed || trimmed === "{}") return path;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return path;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return path;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    searchParams.append(
      key,
      typeof value === "object" ? JSON.stringify(value) : String(value),
    );
  }

  const qs = searchParams.toString();
  if (!qs) return path;

  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

function parseCostHeader(headers: Headers | undefined): number {
  const raw = headers?.get?.(COST_HEADER);
  if (raw === null || raw === undefined || raw.trim() === "") return 0;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = (response.headers?.get?.("content-type") ?? "").toLowerCase();
  const isJson =
    contentType.includes("application/json") || contentType.includes("+json");

  if (isJson) {
    const text = await response.text();
    if (text.trim() === "") return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return response.text();
}

function safeMessageForHttpStatus(status: number): string {
  const { category } = classifyHttpError(status);

  if (category === "rate_limit") {
    return getSafeErrorMessage(null, "RATE_LIMIT_EXCEEDED");
  }
  if (category === "server_error") {
    return getSafeErrorMessage(null, "SERVER_ERROR");
  }
  if (category === "client_error") {
    if (status === 401) return getSafeErrorMessage(null, "UNAUTHORIZED");
    if (status === 403) return getSafeErrorMessage(null, "FORBIDDEN");
    if (status === 404) return getSafeErrorMessage(null, "NOT_FOUND");
    return getSafeErrorMessage(null, "INVALID_REQUEST");
  }

  return getSafeErrorMessage(null, "UNKNOWN_ERROR");
}

/**
 * Execute a real test call against the configured endpoint using `authFetch`.
 *
 * - GET requests serialize JSON object params into the query string and send no body.
 * - Non-GET requests send a JSON body with `Content-Type: application/json`.
 * - Latency is measured with `performance.now()`.
 * - Cost is read from `X-Callora-Cost` (defaulting to 0).
 * - HTTP 4xx/5xx and network failures return `status: "error"` with a safe generic message.
 * - Aborted requests re-throw the `AbortError`.
 */
export async function runTestCall({
  endpoint,
  params,
  signal,
}: RunTestCallOptions): Promise<TestCallResult> {
  const isGet = endpoint.method === "GET";
  const requestPath = isGet
    ? buildPathWithQuery(endpoint.path, params)
    : endpoint.path;

  const init: RequestInit = {
    method: endpoint.method,
    headers: isGet
      ? { Accept: "application/json" }
      : { Accept: "application/json", "Content-Type": "application/json" },
    signal,
  };

  if (!isGet) {
    init.body = params.trim() === "" ? "{}" : params;
  }

  const startTime = performance.now();

  let response: Response;
  try {
    response = await authFetch(requestPath, init);
  } catch (error) {
    if (isAbortError(error, signal)) {
      throw error;
    }
    const responseTime = Math.max(0, Math.round(performance.now() - startTime));
    const errorMessage = getSafeErrorMessage(error, "NETWORK_ERROR");
    return {
      ok: false,
      status: "error",
      httpStatus: null,
      responseTime,
      cost: 0,
      body: { error: errorMessage },
      errorMessage,
    };
  }

  const responseTime = Math.max(0, Math.round(performance.now() - startTime));
  const cost = parseCostHeader(response.headers);

  if (!response.ok) {
    const errorMessage = safeMessageForHttpStatus(response.status);
    return {
      ok: false,
      status: "error",
      httpStatus: response.status,
      responseTime,
      cost,
      body: { error: errorMessage, status: response.status },
      errorMessage,
    };
  }

  const body = await parseResponseBody(response);

  return {
    ok: true,
    status: "success",
    httpStatus: response.status,
    responseTime,
    cost,
    body,
  };
}
