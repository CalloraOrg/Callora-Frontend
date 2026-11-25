import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildLatencyPath,
  fetchLatencySeries,
  getDemoLatencyData,
  isLatencyAbortError,
  isLatencyDemoMode,
  LatencyFetchError,
  validateLatencyPoint,
  validateLatencyResponse,
} from "./latencyApi";
import * as authFetchModule from "../services/authFetch";
import * as constants from "../config/constants";

describe("latencyApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildLatencyPath", () => {
    it("builds encoded endpoint path with range query", () => {
      expect(buildLatencyPath("weather-api", "24h")).toBe(
        "/api/apis/weather-api/latency?range=24h",
      );
      expect(buildLatencyPath("org/my api", "7d")).toBe(
        "/api/apis/org%2Fmy%20api/latency?range=7d",
      );
    });
  });

  describe("validateLatencyPoint & validateLatencyResponse", () => {
    it("validates a well-formed point with ISO string timestamp", () => {
      const point = validateLatencyPoint({
        label: "12:00",
        value: 142,
        timestamp: "2026-09-01T12:00:00Z",
      });

      expect(point.label).toBe("12:00");
      expect(point.value).toBe(142);
      expect(point.timestamp).toBeInstanceOf(Date);
      expect(point.timestamp.toISOString()).toBe("2026-09-01T12:00:00.000Z");
    });

    it("rejects malformed points and non-numeric values", () => {
      expect(() => validateLatencyPoint(null)).toThrow(LatencyFetchError);
      expect(() => validateLatencyPoint("bad")).toThrow(LatencyFetchError);
      expect(() =>
        validateLatencyPoint({ label: "", value: 100, timestamp: "2026-09-01T00:00:00Z" }),
      ).toThrow(/label/);
      expect(() =>
        validateLatencyPoint({ label: "00:00", value: "100", timestamp: "2026-09-01T00:00:00Z" }),
      ).toThrow(/numeric/);
      expect(() =>
        validateLatencyPoint({ label: "00:00", value: Number.NaN, timestamp: "2026-09-01T00:00:00Z" }),
      ).toThrow(/numeric/);
      expect(() =>
        validateLatencyPoint({ label: "00:00", value: -5, timestamp: "2026-09-01T00:00:00Z" }),
      ).toThrow(/numeric/);
      expect(() =>
        validateLatencyPoint({ label: "00:00", value: 100, timestamp: "not-a-date" }),
      ).toThrow(/timestamp/);
    });

    it("validates { data } response with optional server p95", () => {
      const res = validateLatencyResponse({
        data: [
          { label: "00:00", value: 120, timestamp: "2026-09-01T00:00:00Z" },
        ],
        p95: 198,
      });

      expect(res.points).toHaveLength(1);
      expect(res.p95).toBe(198);
    });

    it("handles empty series", () => {
      const res = validateLatencyResponse({ data: [] });
      expect(res.points).toEqual([]);
      expect(res.p95).toBeUndefined();
    });

    it("rejects invalid response shapes and non-numeric p95", () => {
      expect(() => validateLatencyResponse(null)).toThrow(LatencyFetchError);
      expect(() => validateLatencyResponse([])).toThrow(LatencyFetchError);
      expect(() => validateLatencyResponse({ data: "bad" })).toThrow(LatencyFetchError);
      expect(() =>
        validateLatencyResponse({ data: [], p95: "200" }),
      ).toThrow(/p95/);
    });
  });

  describe("fetchLatencySeries", () => {
    it("calls authFetch with path and signal and returns validated points", async () => {
      const spy = vi.spyOn(authFetchModule, "authFetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { label: "10:00", value: 90, timestamp: "2026-09-01T10:00:00Z" },
              { label: "11:00", value: 150, timestamp: "2026-09-01T11:00:00Z" },
            ],
            p95: 148,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const controller = new AbortController();
      const result = await fetchLatencySeries({
        apiId: "payments-api",
        range: "24h",
        signal: controller.signal,
      });

      expect(spy).toHaveBeenCalledWith(
        "/api/apis/payments-api/latency?range=24h",
        expect.objectContaining({
          method: "GET",
          signal: controller.signal,
        }),
      );
      expect(result.points).toHaveLength(2);
      expect(result.points[0].timestamp).toBeInstanceOf(Date);
      expect(result.p95).toBe(148);
    });

    it("maps 401 from authFetch to UNAUTHORIZED LatencyFetchError", async () => {
      vi.spyOn(authFetchModule, "authFetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      );

      await expect(
        fetchLatencySeries({ apiId: "payments-api" }),
      ).rejects.toMatchObject({
        name: "LatencyFetchError",
        status: 401,
        code: "UNAUTHORIZED",
      });
    });

    it("maps 500 to HTTP_ERROR LatencyFetchError", async () => {
      vi.spyOn(authFetchModule, "authFetch").mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      await expect(
        fetchLatencySeries({ apiId: "payments-api" }),
      ).rejects.toMatchObject({
        name: "LatencyFetchError",
        status: 500,
        code: "HTTP_ERROR",
      });
    });

    it("maps invalid JSON to INVALID_RESPONSE LatencyFetchError", async () => {
      vi.spyOn(authFetchModule, "authFetch").mockResolvedValue(
        new Response("not-json", { status: 200 }),
      );

      await expect(
        fetchLatencySeries({ apiId: "payments-api" }),
      ).rejects.toMatchObject({
        name: "LatencyFetchError",
        code: "INVALID_RESPONSE",
      });
    });

    it("maps network failure to NETWORK_ERROR LatencyFetchError", async () => {
      vi.spyOn(authFetchModule, "authFetch").mockRejectedValue(
        new TypeError("Failed to fetch"),
      );

      await expect(
        fetchLatencySeries({ apiId: "payments-api" }),
      ).rejects.toMatchObject({
        name: "LatencyFetchError",
        code: "NETWORK_ERROR",
      });
    });

    it("rejects with AbortError when signal is already aborted or aborts mid-flight", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        fetchLatencySeries({ apiId: "payments-api", signal: controller.signal }),
      ).rejects.toSatisfy(isLatencyAbortError);

      const inFlight = new AbortController();
      vi.spyOn(authFetchModule, "authFetch").mockImplementation(() => {
        inFlight.abort();
        const err = new Error("Aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      });

      await expect(
        fetchLatencySeries({ apiId: "payments-api", signal: inFlight.signal }),
      ).rejects.toSatisfy(isLatencyAbortError);
    });

    it("detects demo mode based on API_BASE and provides sample data", () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("");
      expect(isLatencyDemoMode()).toBe(true);
      expect(getDemoLatencyData().length).toBeGreaterThan(0);

      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      expect(isLatencyDemoMode()).toBe(false);
    });
  });
});
