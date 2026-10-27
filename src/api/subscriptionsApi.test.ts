import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  listActive,
  subscribe,
  unsubscribe,
  SubscriptionsApiError,
  isSubscriptionsAbortError,
  normalizeSubscriptionStatus,
  adaptBackendSubscription,
  validateSubscriptionsListResponse,
  validateSubscriptionResponse,
  isSubscriptionsDemoMode,
  SUBSCRIPTIONS_PATH,
} from "./subscriptionsApi";
import { addAccount, switchAccount, _reset } from "../state/accountStore";
import * as constants from "../config/constants";

describe("subscriptionsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    _reset();
  });

  afterEach(() => {
    localStorage.clear();
    _reset();
  });

  describe("normalizeSubscriptionStatus", () => {
    it("normalizes known statuses", () => {
      expect(normalizeSubscriptionStatus("active")).toBe("active");
      expect(normalizeSubscriptionStatus("PAUSED")).toBe("paused");
      expect(normalizeSubscriptionStatus(" cancelled ")).toBe("cancelled");
    });

    it("falls back to unknown for non-strings or invalid strings", () => {
      expect(normalizeSubscriptionStatus(null)).toBe("unknown");
      expect(normalizeSubscriptionStatus(undefined)).toBe("unknown");
      expect(normalizeSubscriptionStatus(123)).toBe("unknown");
      expect(normalizeSubscriptionStatus("deleted")).toBe("unknown");
    });
  });

  describe("adaptBackendSubscription", () => {
    it("throws if input is not an object", () => {
      expect(() => adaptBackendSubscription(null)).toThrow(SubscriptionsApiError);
      expect(() => adaptBackendSubscription("str")).toThrow(SubscriptionsApiError);
    });

    it("throws if id or api_id is missing", () => {
      expect(() => adaptBackendSubscription({ api_id: "api-1" })).toThrow("missing an id");
      expect(() => adaptBackendSubscription({ id: "sub-1" })).toThrow("missing api_id");
    });

    it("adapts valid backend subscription with snake_case and camelCase", () => {
      const sub1 = adaptBackendSubscription({
        id: "sub-123",
        api_id: "api-weather",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      });
      expect(sub1.id).toBe("sub-123");
      expect(sub1.apiId).toBe("api-weather");
      expect(sub1.status).toBe("active");
      expect(sub1.rawStatus).toBe("active");
      expect(sub1.createdAt).toBe("2026-01-01T00:00:00Z");

      const sub2 = adaptBackendSubscription({
        id: "sub-456",
        apiId: "api-finance",
        status: "PAUSED",
        createdAt: "2026-02-01T00:00:00Z",
        updatedAt: "2026-02-02T00:00:00Z",
      });
      expect(sub2.id).toBe("sub-456");
      expect(sub2.apiId).toBe("api-finance");
      expect(sub2.status).toBe("paused");
    });
  });

  describe("validateSubscriptionsListResponse & validateSubscriptionResponse", () => {
    it("parses raw arrays", () => {
      const res = validateSubscriptionsListResponse([
        { id: "sub-1", api_id: "api-1", status: "active" },
      ]);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("sub-1");
    });

    it("parses { data: [...] } and { subscriptions: [...] }", () => {
      const res1 = validateSubscriptionsListResponse({
        data: [{ id: "sub-1", api_id: "api-1", status: "active" }],
      });
      expect(res1).toHaveLength(1);

      const res2 = validateSubscriptionsListResponse({
        subscriptions: [{ id: "sub-2", api_id: "api-2", status: "active" }],
      });
      expect(res2).toHaveLength(1);
    });

    it("throws SubscriptionsApiError if list shape is invalid", () => {
      expect(() => validateSubscriptionsListResponse({ invalid: true })).toThrow(
        SubscriptionsApiError,
      );
    });

    it("parses single subscription response envelope or raw", () => {
      const s1 = validateSubscriptionResponse({ id: "sub-1", api_id: "api-1", status: "active" });
      expect(s1.id).toBe("sub-1");

      const s2 = validateSubscriptionResponse({
        data: { id: "sub-2", api_id: "api-2", status: "active" },
      });
      expect(s2.id).toBe("sub-2");

      const s3 = validateSubscriptionResponse({
        subscription: { id: "sub-3", api_id: "api-3", status: "active" },
      });
      expect(s3.id).toBe("sub-3");
    });
  });

  describe("listActive", () => {
    it("fetches active subscriptions and attaches authorization header", async () => {
      addAccount({ id: "acc-1", label: "Test Acc", apiKey: "secret-key-123" });
      switchAccount("acc-1");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: "sub-1", api_id: "api-weather", status: "active" }],
      } as unknown as Response);

      const result = await listActive({ fetchImpl: mockFetch });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain(`${SUBSCRIPTIONS_PATH}?status=active`);
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer secret-key-123");
      expect(headers.get("Accept")).toBe("application/json");
      expect(result).toHaveLength(1);
      expect(result[0].apiId).toBe("api-weather");
    });

    it("throws UNAUTHORIZED on 401", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(listActive({ fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        status: 401,
      });
    });

    it("throws NETWORK_ERROR when fetch fails", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      await expect(listActive({ fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      });
    });

    it("throws HTTP_ERROR on 500", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      await expect(listActive({ fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "HTTP_ERROR",
        status: 500,
      });
    });

    it("handles abort signals cleanly", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(listActive({ signal: controller.signal })).rejects.toThrow(
        "The operation was aborted.",
      );
    });

    it("handles unreadable response JSON", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid json");
        },
      } as unknown as Response);

      await expect(listActive({ fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    });
  });

  describe("subscribe", () => {
    it("posts api_id and includes Idempotency-Key", async () => {
      addAccount({ id: "acc-1", label: "Test Acc", apiKey: "api-tok" });
      switchAccount("acc-1");

      let receivedKey = "";
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        const headers = new Headers(init.headers);
        receivedKey = headers.get("Idempotency-Key") || "";
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: "sub-999",
            api_id: "api-geo",
            status: "active",
          }),
        } as Response;
      });

      const res = await subscribe("api-geo", { fetchImpl: mockFetch });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain(SUBSCRIPTIONS_PATH);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ api_id: "api-geo" });
      expect(receivedKey).toBeTruthy();
      expect(receivedKey.length).toBeGreaterThan(10);
      expect(res.id).toBe("sub-999");
    });

    it("uses provided idempotencyKey if specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: "sub-999", api_id: "api-geo", status: "active" }),
      } as unknown as Response);

      await subscribe("api-geo", {
        idempotencyKey: "custom-idempotency-key",
        fetchImpl: mockFetch,
      });

      const [, init] = mockFetch.mock.calls[0];
      const headers = new Headers(init.headers);
      expect(headers.get("Idempotency-Key")).toBe("custom-idempotency-key");
    });

    it("throws INVALID_RESPONSE when apiId is empty", async () => {
      await expect(subscribe("")).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    });

    it("throws CONFLICT on 409", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: "Already subscribed" }),
      } as unknown as Response);

      await expect(subscribe("api-geo", { fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "CONFLICT",
        status: 409,
      });
    });

    it("throws NOT_FOUND on 404", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "API not found" }),
      } as unknown as Response);

      await expect(subscribe("api-geo", { fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("throws UNAUTHORIZED on 401", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(subscribe("api-geo", { fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        status: 401,
      });
    });

    it("throws HTTP_ERROR on 500", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal server error" }),
      } as unknown as Response);

      await expect(subscribe("api-geo", { fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "HTTP_ERROR",
        status: 500,
      });
    });
  });

  describe("unsubscribe", () => {
    it("calls DELETE /api/subscriptions/:id", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response);

      await unsubscribe("sub-123", { fetchImpl: mockFetch });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain(`${SUBSCRIPTIONS_PATH}/sub-123`);
      expect(init.method).toBe("DELETE");
    });

    it("throws INVALID_RESPONSE when subscriptionId is empty", async () => {
      await expect(unsubscribe("")).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    });

    it("throws UNAUTHORIZED on 401", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(unsubscribe("sub-123", { fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        status: 401,
      });
    });

    it("throws NOT_FOUND on 404", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      await expect(unsubscribe("sub-123", { fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("throws HTTP_ERROR on 500", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Internal server error" }),
      } as unknown as Response);

      await expect(unsubscribe("sub-123", { fetchImpl: mockFetch })).rejects.toMatchObject({
        code: "HTTP_ERROR",
        status: 500,
      });
    });

    it("parses error string property if message is absent", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Custom error" }),
      } as unknown as Response);

      await expect(unsubscribe("sub-123", { fetchImpl: mockFetch })).rejects.toThrow("Custom error");
    });

    it("handles json parse failure on error response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("bad json");
        },
      } as unknown as Response);

      await expect(unsubscribe("sub-123", { fetchImpl: mockFetch })).rejects.toThrow("Could not unsubscribe");
    });
  });

  describe("demo mode & helper predicates", () => {
    it("reports demo mode based on API_BASE", () => {
      expect(typeof isSubscriptionsDemoMode()).toBe("boolean");
    });

    it("identifies AbortError", () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      expect(isSubscriptionsAbortError(err)).toBe(true);
      expect(isSubscriptionsAbortError(new Error("regular error"))).toBe(false);
      expect(isSubscriptionsAbortError(null)).toBe(false);
    });
  });
});
