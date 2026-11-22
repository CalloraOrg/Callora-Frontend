import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  adaptBackendApi,
  buildCacheKey,
  clearCatalogCache,
  createCatalogApi,
  fetchApiHealth,
  fetchCatalog,
  isCatalogAbortError,
  normalizeApiHealth,
  normalizeCatalog,
  CatalogFetchError,
} from "./catalogApi";
import * as constants from "../config/constants";
import MOCK_APIS from "../data/mockApis";
import { invalidateAccountCache } from "../utils/offlineApiCache";

const originalFetch = globalThis.fetch;
const originalSessionStorage = globalThis.sessionStorage;

const mockSessionStorage: Record<string, string> = {};

function createMockSessionStorage() {
  return {
    getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockSessionStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockSessionStorage[key];
    }),
    key: vi.fn((index: number) => Object.keys(mockSessionStorage)[index] ?? null),
    get length() {
      return Object.keys(mockSessionStorage).length;
    },
    clear: vi.fn(() => {
      Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
    }),
  };
}

describe("catalogApi module", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.sessionStorage = createMockSessionStorage() as unknown as Storage;
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
    clearCatalogCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.sessionStorage = originalSessionStorage;
  });

  describe("buildCacheKey", () => {
    it("returns base key for empty params", () => {
      expect(buildCacheKey({})).toBe("callora-catalog-cache-all");
    });

    it("includes search param", () => {
      expect(buildCacheKey({ search: "geo" })).toBe("callora-catalog-cache-search=geo");
    });

    it("includes category param", () => {
      expect(buildCacheKey({ category: "Finance" })).toBe("callora-catalog-cache-category=Finance");
    });

    it("includes both search and category", () => {
      expect(buildCacheKey({ search: "geo", category: "Finance" })).toBe(
        "callora-catalog-cache-search=geo&category=Finance",
      );
    });

    it("trims whitespace and omits empty values", () => {
      expect(buildCacheKey({ search: "  geo  ", category: "" })).toBe(
        "callora-catalog-cache-search=geo",
      );
      expect(buildCacheKey({ search: "", category: "  Finance  " })).toBe(
        "callora-catalog-cache-category=Finance",
      );
    });
  });

  describe("clearCatalogCache", () => {
    it("removes all catalog cache keys from sessionStorage", () => {
      globalThis.sessionStorage.setItem("callora-catalog-cache-search=geo", "[]");
      globalThis.sessionStorage.setItem("callora-catalog-cache-category=Finance", "[]");
      globalThis.sessionStorage.setItem("unrelated-key", "val");

      clearCatalogCache();

      expect(globalThis.sessionStorage.getItem("callora-catalog-cache-search=geo")).toBeNull();
      expect(globalThis.sessionStorage.getItem("callora-catalog-cache-category=Finance")).toBeNull();
      expect(globalThis.sessionStorage.getItem("unrelated-key")).toBe("val");
    });
  });

  describe("adaptBackendApi", () => {
    it("converts a full backend API row into an APIItem (Scenario 5)", () => {
      const row = {
        id: "10",
        name: "Acme Payments",
        description: "Fast transfers",
        category: "Finance",
        developer: {
          name: "Acme Corp",
          website: "https://acme.example.com",
        },
        logo_url: "https://pay.example.com/logo.png",
        base_url: "https://pay.example.com",
        status: "operational",
        endpoints: [
          { path: "/pay", price_per_call: 0.02 },
          { path: "/status", price_per_call: 0.05 },
        ],
      };

      const item = adaptBackendApi(row);
      expect(item).not.toBeNull();
      expect(item?.id).toBe("10");
      expect(item?.name).toBe("Acme Payments");
      expect(item?.description).toBe("Fast transfers");
      expect(item?.category).toBe("Finance");
      expect(item?.provider.name).toBe("Acme Corp");
      expect(item?.provider.url).toBe("https://acme.example.com");
      expect(item?.provider.avatar).toBe("https://pay.example.com/logo.png");
      expect(item?.baseUrl).toBe("https://pay.example.com");
      expect(item?.status).toBe("operational");
      expect(item?.pricePerRequest).toBe(0.02);
      expect(item?.pricingOnRequest).toBe(false);
    });

    it("falls back to 'Unknown provider' when developer is missing (Scenario 5)", () => {
      const row = {
        id: 12,
        name: "Anonymous Tool",
      };

      const item = adaptBackendApi(row);
      expect(item).not.toBeNull();
      expect(item?.id).toBe("12");
      expect(item?.provider.name).toBe("Unknown provider");
      expect(item?.provider.url).toBeUndefined();
    });

    it("drops rows with id: null or invalid id (Scenario 6)", () => {
      expect(adaptBackendApi({ id: null, name: "Null API" })).toBeNull();
      expect(adaptBackendApi({ id: undefined, name: "Undef API" })).toBeNull();
      expect(adaptBackendApi({ id: "", name: "Empty ID" })).toBeNull();
      expect(adaptBackendApi({ id: 5 })).toBeNull();
      expect(adaptBackendApi(null)).toBeNull();
      expect(adaptBackendApi("not an object")).toBeNull();
    });

    it("maps unknown status to undefined", () => {
      const row = {
        id: 99,
        name: "Custom API",
        status: "experimental_status",
      };
      const item = adaptBackendApi(row);
      expect(item?.status).toBeUndefined();
    });

    it("sets pricingOnRequest when endpoints have no numeric pricing", () => {
      const row = {
        id: 101,
        name: "Enterprise Custom API",
        endpoints: [{ path: "/enterprise" }],
      };
      const item = adaptBackendApi(row);
      expect(item?.pricePerRequest).toBe(0);
      expect(item?.pricingOnRequest).toBe(true);
    });
  });

  describe("normalizeCatalog", () => {
    it("handles backend response shape { data: [...], meta: {...} } dropping invalid rows (Scenario 1 & 6)", () => {
      const payload = {
        data: [
          { id: 7, name: "API Seven", developer: { name: "Dev 7" } },
          { id: null, name: "Broken Row" },
          { id: 8, name: "API Eight", developer: { name: "Dev 8" } },
        ],
        meta: { limit: 10, hasMore: false },
      };

      const normalized = normalizeCatalog(payload);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].id).toBe("7");
      expect(normalized[0].provider.name).toBe("Dev 7");
      expect(normalized[1].id).toBe("8");
      expect(normalized[1].provider.name).toBe("Dev 8");
    });

    it("handles legacy array with APIItem objects", () => {
      const legacyItem = {
        id: "legacy-1",
        name: "Legacy Service",
        provider: { name: "Legacy Corp" },
        description: "Desc",
        pricePerRequest: 0.01,
      };
      const normalized = normalizeCatalog([legacyItem]);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].id).toBe("legacy-1");
    });

    it("throws CatalogFetchError when payload is not an array or object list", () => {
      expect(() => normalizeCatalog(null)).toThrow(CatalogFetchError);
      expect(() => normalizeCatalog("random string")).toThrow(CatalogFetchError);
      expect(() => normalizeCatalog({ other: "field" })).toThrow(CatalogFetchError);
    });
  });

  describe("createCatalogApi wire protocol", () => {
    it("sends request to target URL ending with /api/apis (Scenario 2)", async () => {
      let requestedUrl = "";
      const mockFetch: typeof fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [{ id: 1, name: "Test API" }],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      });

      const api = createCatalogApi({
        baseUrl: "https://api.callora.test",
        fetchImpl: mockFetch,
      });

      const items = await api.fetchCatalog();
      expect(requestedUrl).toBe("https://api.callora.test/api/apis");
      expect(requestedUrl.endsWith("/api/apis")).toBe(true);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe("1");
    });

    it("serialises search and category query params correctly (Issue #1328)", async () => {
      let requestedUrl = "";
      const mockFetch: typeof fetch = vi.fn().mockImplementation((url: string) => {
        requestedUrl = url;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [{ id: 1, name: "Filtered API" }],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      });

      const api = createCatalogApi({
        baseUrl: "https://api.callora.test",
        fetchImpl: mockFetch,
      });

      await api.fetchCatalog(undefined, { search: "geo", category: "Finance" });
      expect(requestedUrl).toBe("https://api.callora.test/api/apis?search=geo&category=Finance");

      await api.fetchCatalog(undefined, { search: "   " });
      expect(requestedUrl).toBe("https://api.callora.test/api/apis");
    });

    it("supports conditional request 304 keeping cached list without flashing empty (Scenario 7)", async () => {
      let requestHeaders: Record<string, string> = {};
      let callCount = 0;

      const mockFetch: typeof fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
        callCount++;
        requestHeaders = (init?.headers as Record<string, string>) || {};

        if (callCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [{ id: 10, name: "ETag API" }],
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ETag: 'W/"v1-hash123"',
                },
              },
            ),
          );
        } else {
          return Promise.resolve(
            new Response(null, {
              status: 304,
              statusText: "Not Modified",
            }),
          );
        }
      });

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch,
      });

      const firstResult = await api.fetchCatalog();
      expect(firstResult).toHaveLength(1);
      expect(firstResult[0].id).toBe("10");

      const secondResult = await api.fetchCatalog();
      expect(requestHeaders["If-None-Match"]).toBe('W/"v1-hash123"');
      expect(secondResult).toEqual(firstResult);
      expect(secondResult).toHaveLength(1);
    });

    it("rejects with AbortError when request signal is aborted (Scenario 8)", async () => {
      const controller = new AbortController();
      controller.abort();

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: vi.fn(),
      });

      await expect(api.fetchCatalog(controller.signal)).rejects.toThrow("The operation was aborted.");
    });

    it("throws CatalogFetchError when backend answers with non-200 / non-304", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue(
        new Response("Server Error", { status: 500 }),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch,
      });

      await expect(api.fetchCatalog()).rejects.toThrow(CatalogFetchError);
    });

    it("throws CatalogFetchError on network connectivity error", async () => {
      const mockFetch: typeof fetch = vi.fn().mockRejectedValue(new Error("Network failed"));

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch,
      });

      await expect(api.fetchCatalog()).rejects.toThrow("Could not reach the marketplace service.");
    });
  });

  describe("fetchCatalog fallback policy", () => {
    it("returns MOCK_APIS when API_BASE is empty (Scenario 4)", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("");

      const result = await fetchCatalog();
      expect(result).toBe(MOCK_APIS);
    });

    it("rejects when API_BASE is set and backend returns 500 (Scenario 3)", async () => {
      vi.spyOn(constants, "API_BASE", "get").mockReturnValue("https://api.callora.com");
      vi.spyOn(constants, "apiUrl").mockImplementation((p) => `https://api.callora.com${p}`);

      const mockFetch = vi.fn().mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );
      globalThis.fetch = mockFetch;

      await expect(fetchCatalog()).rejects.toThrow(CatalogFetchError);
    });
  });

  describe("resolveApisByIds", () => {
    const makeBackendRow = (id: string, name: string) => ({
      id,
      name,
      description: `${name} desc`,
      developer: { name: "Dev Co" },
      price: 0.02,
    });

    it("returns empty arrays immediately for an empty id list without fetching", async () => {
      const mockFetch = vi.fn();
      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch,
      });

      const result = await api.resolveApisByIds([]);
      expect(result).toEqual({ apis: [], missing: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("serves from the cached catalogue without additional fetches (cache hit)", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            makeBackendRow("api-1", "One"),
            makeBackendRow("api-2", "Two"),
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch,
      });

      await api.fetchCatalog();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const result = await api.resolveApisByIds(["api-2", "api-1", "api-2"]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.apis.map((a) => a.id)).toEqual(["api-2", "api-1"]);
      expect(result.missing).toEqual([]);
    });

    it("fetches only missing ids on partial miss and records 404s in missing", async () => {
      const mockFetch = vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/apis")) {
          return Promise.resolve(
            new Response(JSON.stringify([makeBackendRow("api-1", "One")]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (url.endsWith("/api/apis/api-2")) {
          return Promise.resolve(
            new Response(JSON.stringify(makeBackendRow("api-2", "Two")), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (url.endsWith("/api/apis/deleted-99")) {
          return Promise.resolve(new Response("Not Found", { status: 404 }));
        }
        return Promise.resolve(new Response("Unexpected", { status: 500 }));
      });

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      await api.fetchCatalog();
      const result = await api.resolveApisByIds(["api-1", "deleted-99", "api-2"]);

      expect(result.apis.map((a) => a.id)).toEqual(["api-1", "api-2"]);
      expect(result.missing).toEqual(["deleted-99"]);
      // 1 for catalog + 1 for api-2 + 1 for deleted-99 (api-1 was a cache hit)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("deduplicates concurrent in-flight requests for the same id", async () => {
      let resolveFetch!: (res: Response) => void;
      const mockFetch = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const p1 = api.resolveApisByIds(["shared-1"]);
      const p2 = api.resolveApisByIds(["shared-1"]);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch(
        new Response(JSON.stringify(makeBackendRow("shared-1", "Shared")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.apis.map((a) => a.id)).toEqual(["shared-1"]);
      expect(r2.apis.map((a) => a.id)).toEqual(["shared-1"]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("rejects with AbortError when signal is aborted", async () => {
      const mockFetch = vi.fn(
        () => new Promise<Response>(() => {}),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const controller = new AbortController();
      const promise = api.resolveApisByIds(["slow-1"], controller.signal);
      controller.abort();

      await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    });

    it("invalidates the resolver cache on account switch via invalidateAccountCache", async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(makeBackendRow("acct-1", "Account API")), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      await api.resolveApisByIds(["acct-1"]);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cached hit before account switch
      await api.resolveApisByIds(["acct-1"]);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Account switch invalidates cache
      invalidateAccountCache("account-b");

      await api.resolveApisByIds(["acct-1"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("fetchApiHealth", () => {
    it("parses a valid points payload into HealthStatus[]", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            points: [
              { at: "2026-01-01T00:00:00Z", status: "operational" },
              { at: "2026-01-01T01:00:00Z", status: "degraded" },
              { at: "2026-01-01T02:00:00Z", status: "down" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await api.fetchApiHealth("geocode-01");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/apis/geocode-01/health",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual(["operational", "degraded", "down"]);
    });

    it("drops unknown or malformed status values", () => {
      const result = normalizeApiHealth({
        points: [
          { at: "2026-01-01T00:00:00Z", status: "operational" },
          { at: "2026-01-01T01:00:00Z", status: "unknown" },
          { at: "2026-01-01T02:00:00Z", status: 123 },
          { at: "2026-01-01T03:00:00Z", status: "degraded" },
          null,
          { at: "2026-01-01T04:00:00Z", status: "down" },
        ],
      });
      expect(result).toEqual(["operational", "degraded", "down"]);
    });

    it("returns an empty array on 404", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(null, { status: 404, statusText: "Not Found" }),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await api.fetchApiHealth("missing-api");
      expect(result).toEqual([]);
    });

    it("throws CatalogFetchError on 500 server error", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(null, { status: 500, statusText: "Internal Server Error" }),
      );

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      await expect(api.fetchApiHealth("broken-api")).rejects.toBeInstanceOf(
        CatalogFetchError,
      );
    });

    it("rejects with AbortError when signal is aborted", async () => {
      const controller = new AbortController();
      const mockFetch = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });

      const api = createCatalogApi({
        baseUrl: "http://localhost:3000",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const promise = api.fetchApiHealth("slow-api", controller.signal);
      controller.abort();

      await expect(promise).rejects.toSatisfy(isCatalogAbortError);
    });

    it("returns an empty array in demo mode (no API_BASE) without throwing", async () => {
      const spy = vi.spyOn(constants, "API_BASE", "get").mockReturnValue("");
      try {
        const result = await fetchApiHealth("geocode-01");
        expect(result).toEqual([]);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
