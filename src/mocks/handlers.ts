import { http, HttpResponse, delay } from "msw";
import {
  MOCK_APIS,
  getProviderApis,
  DEMO_INVOICES_RESPONSE,
  MOCK_TRANSACTIONS,
  DEMO_USAGE,
  DEMO_WEBHOOK_DELIVERIES,
  DEMO_QUOTA,
  type QuotaRecord,
} from "./fixtures";

/**
 * Global mock configuration to toggle simulated latency or error states for UI tests.
 */
export const mockConfig = {
  latencyMs: 0,
  forceError: false,
  reset() {
    this.latencyMs = 0;
    this.forceError = false;
  },
};

// In-memory quota store for /api/quota GET and PUT
const quotaStore = new Map<string, QuotaRecord>();

export function resetQuotaStore(): void {
  quotaStore.clear();
  quotaStore.set(DEMO_QUOTA.accountId, { ...DEMO_QUOTA });
}

// Initialize quota store
resetQuotaStore();

function getOrInitQuota(accountId: string): QuotaRecord {
  const existing = quotaStore.get(accountId);
  if (existing) return existing;
  const initial: QuotaRecord = {
    accountId,
    value: 0,
    version: 1,
    updatedAt: Date.now(),
  };
  quotaStore.set(accountId, initial);
  return initial;
}

const CATALOG_ETAG = 'W/"demo-catalog"';

export const handlers = [
  // ── 1. Catalogue listings (/api/apis) ────────────────────────────────────
  http.get("*/api/apis", async ({ request }) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    const ifNoneMatch = request.headers.get("if-none-match") ?? request.headers.get("If-None-Match");
    if (ifNoneMatch === CATALOG_ETAG) {
      return new HttpResponse(null, {
        status: 304,
        headers: { ETag: CATALOG_ETAG },
      });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().toLowerCase();
    const category = url.searchParams.get("category")?.trim().toLowerCase();

    let items = [...MOCK_APIS];
    if (search) {
      items = items.filter(
        (api) =>
          api.name.toLowerCase().includes(search) ||
          api.description?.toLowerCase().includes(search),
      );
    }
    if (category) {
      items = items.filter(
        (api) => api.category?.toLowerCase() === category,
      );
    }

    return HttpResponse.json(items, {
      headers: {
        ETag: CATALOG_ETAG,
      },
    });
  }),

  // ── 2. Catalogue detail & health (/api/apis/:id) ─────────────────────────
  http.get("*/api/apis/:id/health", async ({ params }) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    const id = String(params.id);
    const found = MOCK_APIS.find((api) => api.id === id);
    if (!found) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({
      points: [
        { at: new Date(Date.now() - 7200000).toISOString(), status: "operational" },
        { at: new Date(Date.now() - 3600000).toISOString(), status: "operational" },
        { at: new Date().toISOString(), status: "operational" },
      ],
    });
  }),

  http.get("*/api/apis/:id", async ({ params }) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    const id = String(params.id);
    const found = MOCK_APIS.find((api) => api.id === id);
    if (!found) {
      return HttpResponse.json({ error: "API not found" }, { status: 404 });
    }

    return HttpResponse.json(found);
  }),

  // ── 3. API Usage (/api/usage) ────────────────────────────────────────────
  http.get("*/api/usage", async () => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    return HttpResponse.json(DEMO_USAGE);
  }),

  // ── 4. Provider APIs (/api/provider/apis) ────────────────────────────────
  http.get("*/api/provider/apis", async () => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    try {
      const providerApis = getProviderApis();
      return HttpResponse.json(providerApis);
    } catch {
      return new HttpResponse(null, { status: 500 });
    }
  }),

  // ── 5. Quota management (/api/quota) ────────────────────────────────────
  http.get("*/api/quota", async ({ request }) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId") || "acme-labs";
    const quota = getOrInitQuota(accountId);
    return HttpResponse.json({ ...quota });
  }),

  http.put("*/api/quota", async ({ request }) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    const body = (await request.json()) as {
      accountId?: string;
      value?: number;
      baseVersion?: number;
    };

    const accountId = body.accountId || "acme-labs";
    const value = typeof body.value === "number" ? body.value : 0;
    const baseVersion = typeof body.baseVersion === "number" ? body.baseVersion : 1;

    const current = getOrInitQuota(accountId);
    if (baseVersion !== current.version) {
      return HttpResponse.json(
        {
          error: "Conflict",
          message: `Stale version: current is v${current.version}, got v${baseVersion}`,
          version: current.version,
        },
        { status: 409 },
      );
    }

    const updated: QuotaRecord = {
      accountId,
      value,
      version: current.version + 1,
      updatedAt: Date.now(),
    };
    quotaStore.set(accountId, updated);

    return HttpResponse.json({ ...updated });
  }),

  // ── 6. Auth endpoints (/api/auth/*) ──────────────────────────────────────
  http.post("*/api/auth/wallet", async () => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    return HttpResponse.json({
      success: true,
      accessToken: "demo-access-token",
      refreshToken: "demo-refresh-token",
      data: {
        accessToken: "demo-access-token",
        refreshToken: "demo-refresh-token",
      },
    });
  }),

  http.post("*/api/auth/refresh", async () => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    return HttpResponse.json({
      success: true,
      accessToken: "demo-refreshed-access-token",
      refreshToken: "demo-refreshed-refresh-token",
      data: {
        accessToken: "demo-refreshed-access-token",
        refreshToken: "demo-refreshed-refresh-token",
      },
    });
  }),

  http.post("*/api/auth/revoke", async () => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    return HttpResponse.json({ success: true });
  }),

  // ── 7. Invoices (/api/invoices) ──────────────────────────────────────────
  http.get("*/api/invoices", async () => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    return HttpResponse.json(DEMO_INVOICES_RESPONSE);
  }),

  // ── 8. Webhook deliveries (/api/webhooks/deliveries) ─────────────────────
  http.get("*/api/webhooks/deliveries", async ({ request }) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    let deliveries = [...DEMO_WEBHOOK_DELIVERIES];
    if (status && status !== "all") {
      deliveries = deliveries.filter((d) => d.status === status);
    }

    return HttpResponse.json({
      data: deliveries,
      totalCount: deliveries.length,
    });
  }),

  http.post("*/api/webhooks/deliveries/:id/retry", async () => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    return HttpResponse.json({ ok: true, status: "pending" });
  }),

  // ── 9. Activity feed (/api/activity) ─────────────────────────────────────
  http.get("*/api/activity", async ({ request }) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    if (mockConfig.forceError) {
      return new HttpResponse(null, { status: 500 });
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || 10;
    const items = MOCK_TRANSACTIONS.slice(0, limit);

    return HttpResponse.json(items);
  }),
];
