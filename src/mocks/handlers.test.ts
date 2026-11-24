import { describe, expect, it, beforeEach } from "vitest";
import { apiUrl } from "../config/constants";
import { normalizeCatalog, normalizeApiDetail } from "../api/catalogApi";
import { validateInvoicesResponse } from "../api/invoicesApi";
import { mockConfig, resetQuotaStore } from "./handlers";
import { DEMO_INVOICE } from "./fixtures";

describe("MSW shared handlers", () => {
  beforeEach(() => {
    mockConfig.reset();
    resetQuotaStore();
  });

  describe("GET /api/apis", () => {
    it("returns catalogue accepted by normalizeCatalog", async () => {
      const response = await fetch(apiUrl("/api/apis"));
      expect(response.status).toBe(200);

      const json = await response.json();
      const normalized = normalizeCatalog(json);
      expect(normalized.length).toBeGreaterThan(0);
      expect(normalized[0]?.id).toBeDefined();
      expect(normalized[0]?.name).toBeDefined();
    });

    it("filters catalogue by search query string", async () => {
      const response = await fetch(apiUrl("/api/apis?search=weather"));
      expect(response.status).toBe(200);

      const json = await response.json();
      const normalized = normalizeCatalog(json);
      expect(normalized.length).toBeGreaterThan(0);
      expect(normalized.every((item) => item.name.toLowerCase().includes("weather") || item.description?.toLowerCase().includes("weather"))).toBe(true);
    });

    it("filters catalogue by category query string", async () => {
      const response = await fetch(apiUrl("/api/apis?category=finance"));
      expect(response.status).toBe(200);

      const json = await response.json();
      const normalized = normalizeCatalog(json);
      expect(normalized.every((item) => item.category?.toLowerCase() === "finance")).toBe(true);
    });

    it("returns 304 Not Modified when ETag matches", async () => {
      const response = await fetch(apiUrl("/api/apis"), {
        headers: { "If-None-Match": 'W/"demo-catalog"' },
      });
      expect(response.status).toBe(304);
    });
  });

  describe("GET /api/apis/:id", () => {
    it("returns an API detail accepted by normalizeApiDetail", async () => {
      const response = await fetch(apiUrl("/api/apis/weather-001"));
      expect(response.status).toBe(200);

      const json = await response.json();
      const normalized = normalizeApiDetail(json);
      expect(normalized).not.toBeNull();
      expect(normalized?.id).toBe("weather-001");
    });

    it("returns 404 for unknown API id", async () => {
      const response = await fetch(apiUrl("/api/apis/unknown-api-id-404"));
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/apis/:id/health", () => {
    it("returns operational points for a valid API", async () => {
      const response = await fetch(apiUrl("/api/apis/weather-001/health"));
      expect(response.status).toBe(200);

      const json = (await response.json()) as { points: Array<{ status: string }> };
      expect(Array.isArray(json.points)).toBe(true);
      expect(json.points.length).toBeGreaterThan(0);
      expect(json.points[0]?.status).toBe("operational");
    });

    it("returns 404 for unknown API id", async () => {
      const response = await fetch(apiUrl("/api/apis/unknown-api-id-404/health"));
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/usage", () => {
    it("returns usage statistics and events with query strings", async () => {
      const response = await fetch(apiUrl("/api/usage?groupBy=day&limit=100"));
      expect(response.status).toBe(200);

      const json = (await response.json()) as { stats: { totalSpent: number }; events: unknown[] };
      expect(json.stats).toBeDefined();
      expect(json.stats.totalSpent).toBe(42.5);
      expect(Array.isArray(json.events)).toBe(true);
    });
  });

  describe("GET /api/provider/apis", () => {
    it("returns published APIs with publishStatus", async () => {
      const response = await fetch(apiUrl("/api/provider/apis"));
      expect(response.status).toBe(200);

      const json = (await response.json()) as Array<{ publishStatus: string }>;
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThan(0);
      expect(["live", "pending", "rejected"]).toContain(json[0]?.publishStatus);
    });
  });

  describe("GET & PUT /api/quota", () => {
    it("returns initial quota record and increments version on update", async () => {
      const getRes = await fetch(apiUrl("/api/quota?accountId=user-1"));
      expect(getRes.status).toBe(200);
      const initial = (await getRes.json()) as { accountId: string; value: number; version: number };
      expect(initial.accountId).toBe("user-1");
      expect(initial.version).toBe(1);

      const putRes = await fetch(apiUrl("/api/quota"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "user-1",
          value: 250,
          baseVersion: initial.version,
        }),
      });
      expect(putRes.status).toBe(200);
      const updated = (await putRes.json()) as { value: number; version: number };
      expect(updated.value).toBe(250);
      expect(updated.version).toBe(2);
    });

    it("returns 409 conflict when baseVersion is stale", async () => {
      const res = await fetch(apiUrl("/api/quota"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "user-conflict",
          value: 100,
          baseVersion: 99,
        }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/*", () => {
    it("handles wallet login, token refresh, and revoke", async () => {
      const loginRes = await fetch(apiUrl("/api/auth/wallet"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: "GB...", signature: "sig", message: "msg" }),
      });
      expect(loginRes.status).toBe(200);
      const loginJson = (await loginRes.json()) as { accessToken: string; refreshToken: string };
      expect(loginJson.accessToken).toBeDefined();
      expect(loginJson.refreshToken).toBeDefined();

      const refreshRes = await fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: loginJson.refreshToken }),
      });
      expect(refreshRes.status).toBe(200);
      const refreshJson = (await refreshRes.json()) as { accessToken: string };
      expect(refreshJson.accessToken).toBeDefined();

      const revokeRes = await fetch(apiUrl("/api/auth/revoke"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: loginJson.refreshToken }),
      });
      expect(revokeRes.status).toBe(200);
    });
  });

  describe("GET /api/invoices", () => {
    it("returns invoice payload accepted by validateInvoicesResponse", async () => {
      const response = await fetch(apiUrl("/api/invoices?limit=20"));
      expect(response.status).toBe(200);

      const json = await response.json();
      const validated = validateInvoicesResponse(json);
      expect(validated.data.length).toBeGreaterThan(0);
      expect(validated.data[0]?.id).toBe(DEMO_INVOICE.id);
      expect(validated.meta.limit).toBe(20);
    });
  });

  describe("GET & POST /api/webhooks/deliveries", () => {
    it("returns deliveries with filtering and allows retry", async () => {
      const allRes = await fetch(apiUrl("/api/webhooks/deliveries"));
      expect(allRes.status).toBe(200);
      const allJson = (await allRes.json()) as { data: Array<{ status: string }>; totalCount: number };
      expect(allJson.data.length).toBeGreaterThan(0);

      const filteredRes = await fetch(apiUrl("/api/webhooks/deliveries?status=failed"));
      expect(filteredRes.status).toBe(200);
      const filteredJson = (await filteredRes.json()) as { data: Array<{ status: string }> };
      expect(filteredJson.data.every((d) => d.status === "failed")).toBe(true);

      const retryRes = await fetch(apiUrl("/api/webhooks/deliveries/dlv_1/retry"), {
        method: "POST",
      });
      expect(retryRes.status).toBe(200);
    });
  });

  describe("GET /api/activity", () => {
    it("returns recent activity items respecting limit parameter", async () => {
      const response = await fetch(apiUrl("/api/activity?accountId=acme-labs&limit=3"));
      expect(response.status).toBe(200);

      const json = (await response.json()) as Array<{ id: string; amount: number }>;
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(3);
    });
  });

  describe("Edge cases & UI state toggles", () => {
    it("forces HTTP 500 when forceError toggle is active", async () => {
      mockConfig.forceError = true;
      const response = await fetch(apiUrl("/api/apis"));
      expect(response.status).toBe(500);
    });

    it("applies simulated latency when latencyMs is set", async () => {
      mockConfig.latencyMs = 50;
      const start = Date.now();
      const response = await fetch(apiUrl("/api/apis"));
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(40);
    });
  });
});
