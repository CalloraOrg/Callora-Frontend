/**
 * latencyApi.ts
 *
 * Client module for fetching API latency time-series data from Callora-Backend.
 *
 * The endpoint path is isolated in `buildLatencyPath` so it can be updated in
 * one place once the backend contract is finalised.
 *
 * Key responsibilities:
 * - Routes authenticated requests through `authFetch` (which prefixes with `apiUrl`
 *   and handles 401 token refresh/retry).
 * - Validates and normalises response payloads into `LatencyPoint[]`, rejecting
 *   malformed points or non-numeric values.
 * - Preserves optional server-computed `p95` when provided.
 * - Provides clearly labelled demo sample data when `API_BASE` is empty.
 */

import { API_BASE } from "../config/constants";
import { authFetch } from "../services/authFetch";
import type { LatencyPoint } from "../utils/downsample";

export type LatencyRange = "24h" | "7d" | "30d" | string;

export interface FetchLatencySeriesOptions {
  apiId: string;
  range?: LatencyRange;
  signal?: AbortSignal;
}

export interface LatencySeriesResponse {
  points: LatencyPoint[];
  p95?: number;
}

/** Raised when the latency endpoint returns a non-OK response or invalid payload. */
export class LatencyFetchError extends Error {
  public readonly status: number | null;
  public readonly code: "UNAUTHORIZED" | "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_RESPONSE";

  constructor(
    message: string,
    status: number | null = null,
    code: LatencyFetchError["code"] = "HTTP_ERROR",
  ) {
    super(message);
    this.name = "LatencyFetchError";
    this.status = status;
    this.code = code;
  }
}

/** Predicate to check if an error is an AbortError. */
export function isLatencyAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function createAbortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Build the relative API path for fetching latency data.
 * Isolated here so the endpoint contract can be adjusted in one place.
 */
export function buildLatencyPath(apiId: string, range: LatencyRange = "24h"): string {
  const encodedId = encodeURIComponent(apiId.trim());
  const params = new URLSearchParams();
  if (range) {
    params.set("range", range);
  }
  const query = params.toString();
  return `/api/apis/${encodedId}/latency${query ? `?${query}` : ""}`;
}

/**
 * Validate and normalise a single latency point.
 * Rejects non-objects, missing labels, non-numeric/negative values, and invalid timestamps.
 */
export function validateLatencyPoint(raw: unknown): LatencyPoint {
  if (!isRecord(raw)) {
    throw new LatencyFetchError(
      "Latency point must be an object.",
      null,
      "INVALID_RESPONSE",
    );
  }

  if (typeof raw.label !== "string" || raw.label.trim() === "") {
    throw new LatencyFetchError(
      "Latency point is missing a valid label.",
      null,
      "INVALID_RESPONSE",
    );
  }

  if (
    typeof raw.value !== "number" ||
    !Number.isFinite(raw.value) ||
    raw.value < 0
  ) {
    throw new LatencyFetchError(
      "Latency point must have a finite non-negative numeric value.",
      null,
      "INVALID_RESPONSE",
    );
  }

  let timestamp: Date;
  if (raw.timestamp instanceof Date) {
    timestamp = raw.timestamp;
  } else if (typeof raw.timestamp === "string" || typeof raw.timestamp === "number") {
    timestamp = new Date(raw.timestamp);
  } else {
    throw new LatencyFetchError(
      "Latency point is missing a valid timestamp.",
      null,
      "INVALID_RESPONSE",
    );
  }

  if (Number.isNaN(timestamp.getTime())) {
    throw new LatencyFetchError(
      "Latency point has an invalid timestamp.",
      null,
      "INVALID_RESPONSE",
    );
  }

  return {
    label: raw.label.trim(),
    value: raw.value,
    timestamp,
  };
}

/**
 * Validate and normalise the latency series response payload.
 * Accepts `{ data: [...] }` or `{ points: [...] }`, with optional top-level `p95`.
 */
export function validateLatencyResponse(payload: unknown): LatencySeriesResponse {
  if (!isRecord(payload)) {
    throw new LatencyFetchError(
      "Invalid latency response shape: expected an object.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const rawList = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.points)
      ? payload.points
      : null;

  if (!rawList) {
    throw new LatencyFetchError(
      "Invalid latency response shape: expected { data: [...] }.",
      null,
      "INVALID_RESPONSE",
    );
  }

  const points = rawList.map((item) => validateLatencyPoint(item));

  let p95: number | undefined;
  const rawP95 = payload.p95;
  if (rawP95 !== undefined && rawP95 !== null) {
    if (typeof rawP95 !== "number" || !Number.isFinite(rawP95) || rawP95 < 0) {
      throw new LatencyFetchError(
        "Invalid latency response: p95 must be a finite non-negative number.",
        null,
        "INVALID_RESPONSE",
      );
    }
    p95 = rawP95;
  }

  return p95 !== undefined ? { points, p95 } : { points };
}

/**
 * Fetch the latency time-series for a given API through `authFetch`.
 */
export async function fetchLatencySeries(
  options: FetchLatencySeriesOptions,
): Promise<LatencySeriesResponse> {
  const { apiId, range = "24h", signal } = options;

  if (signal?.aborted) {
    throw createAbortError();
  }

  const path = buildLatencyPath(apiId, range);

  let response: Response;
  try {
    response = await authFetch(path, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    });
  } catch (err) {
    if (signal?.aborted || isLatencyAbortError(err)) {
      throw createAbortError();
    }
    throw new LatencyFetchError(
      "Could not reach the latency service. Check your connection and try again.",
      null,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new LatencyFetchError(
        "Sign in to view latency data.",
        401,
        "UNAUTHORIZED",
      );
    }
    throw new LatencyFetchError(
      "Could not load latency data. Please try again.",
      response.status,
      "HTTP_ERROR",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LatencyFetchError(
      "The latency service returned an unreadable response.",
      response.status,
      "INVALID_RESPONSE",
    );
  }

  return validateLatencyResponse(payload);
}

/** Whether the app is running in static demo mode (no `VITE_API_BASE_URL` configured). */
export function isLatencyDemoMode(): boolean {
  return !API_BASE;
}

/** Clearly labelled sample latency series used only when `API_BASE` is empty. */
export function getDemoLatencyData(): LatencyPoint[] {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  return [
    { label: "00:00", value: 120, timestamp: new Date(now - 24 * hour) },
    { label: "01:00", value: 115, timestamp: new Date(now - 23 * hour) },
    { label: "02:00", value: 95, timestamp: new Date(now - 22 * hour) },
    { label: "03:00", value: 88, timestamp: new Date(now - 21 * hour) },
    { label: "04:00", value: 92, timestamp: new Date(now - 20 * hour) },
    { label: "05:00", value: 105, timestamp: new Date(now - 19 * hour) },
    { label: "06:00", value: 145, timestamp: new Date(now - 18 * hour) },
    { label: "07:00", value: 160, timestamp: new Date(now - 17 * hour) },
    { label: "08:00", value: 210, timestamp: new Date(now - 16 * hour) },
    { label: "09:00", value: 195, timestamp: new Date(now - 15 * hour) },
    { label: "10:00", value: 180, timestamp: new Date(now - 14 * hour) },
    { label: "11:00", value: 175, timestamp: new Date(now - 13 * hour) },
    { label: "12:00", value: 185, timestamp: new Date(now - 12 * hour) },
    { label: "13:00", value: 170, timestamp: new Date(now - 11 * hour) },
    { label: "14:00", value: 168, timestamp: new Date(now - 10 * hour) },
    { label: "15:00", value: 165, timestamp: new Date(now - 9 * hour) },
    { label: "16:00", value: 190, timestamp: new Date(now - 8 * hour) },
    { label: "17:00", value: 200, timestamp: new Date(now - 7 * hour) },
    { label: "18:00", value: 195, timestamp: new Date(now - 6 * hour) },
    { label: "19:00", value: 175, timestamp: new Date(now - 5 * hour) },
    { label: "20:00", value: 155, timestamp: new Date(now - 4 * hour) },
    { label: "21:00", value: 140, timestamp: new Date(now - 3 * hour) },
    { label: "22:00", value: 130, timestamp: new Date(now - 2 * hour) },
    { label: "23:00", value: 125, timestamp: new Date(now - 1 * hour) },
    { label: "Now", value: 120, timestamp: new Date(now) },
  ];
}
