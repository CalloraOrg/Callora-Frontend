import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  adaptBackendApi,
  createCatalogApi,
  fetchCatalog,
  normalizeCatalog,
  CATALOG_PATH,
  CatalogFetchError,
  isCatalogAbortError,
} from "./catalogApi";
import MOCK_APIS from "../data/mockApis";
import * as constants from "../config/constants";

describe("catalogApi and adaptBackendApi (Issue #1327)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("adaptBackendApi", () => {
    it("adapts backend row with number id, developer mapping, logo, status and endpoint pricing (Scenario 1)", () => {
      const backendRow = {
        id: 7,
        name: "Payments Engine",
        description: "Fast multi-currency settlement",
        base_url: "https://pay.example.com",
        logo_url: "https://pay.example.com/logo.png",
        category: "Finance",
        status: "operational",
        developer: {
          name: "Acme Payments",
          website: "https://acme.example.com",
          description: "Fintech innovator",
        },
        endpoints: [
          { path: "/charge", price: 0.05 },
          { path: "/refund", price_per_call: 0.02 },
        ],
      };

      const item = adaptBackendApi(backendRow);
      expect(item).not.toBeNull();
      expect(item?.id).toBe("7");
      expect(item?.name).toBe("Payments Engine");
      expect(item?.provider.name).toBe("Acme Payments");
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
      expect(adaptBackendApi({ id: 5 })).toBeNull(); // missing name
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
          // Second call: 304 Not Modified
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
});
