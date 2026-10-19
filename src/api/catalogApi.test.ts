import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCatalog, clearCatalogCache, buildCacheKey } from "./catalogApi";

const originalFetch = global.fetch;
const originalSessionStorage = global.sessionStorage;

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

function createAbortSignal(): AbortSignal {
  return new AbortController().signal;
}

const TEST_BASE_URL = "https://api.example.com";

vi.mock("../config/api", () => ({
  getApiBaseUrl: vi.fn(() => TEST_BASE_URL),
}));

describe("catalogApi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
    global.sessionStorage = createMockSessionStorage() as unknown as Storage;
    mockSessionStorage.length = 0;
    clearCatalogCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    global.sessionStorage = originalSessionStorage;
    clearCatalogCache();
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
        "callora-catalog-cache-search=geo&category=Finance"
      );
    });

    it("trims whitespace and omits empty values", () => {
      expect(buildCacheKey({ search: "  geo  ", category: "" })).toBe("callora-catalog-cache-search=geo");
      expect(buildCacheKey({ search: "", category: "  Finance  " })).toBe(
        "callora-catalog-cache-category=Finance"
      );
    });
  });

  describe("fetchCatalog", () => {
    const mockResponse = {
      items: [
        { id: "1", name: "API 1", provider: { name: "Provider" }, description: "Desc", pricePerRequest: 0.01 },
        { id: "2", name: "API 2", provider: { name: "Provider" }, description: "Desc", pricePerRequest: 0.02 },
      ],
      total: 2,
      page: 1,
      pageSize: 12,
    };

    beforeEach(() => {
      clearCatalogCache();
      (global.fetch as vi.Mock).mockReset();
    });

    it("fetches with search param", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchCatalog(createAbortSignal(), { search: "geo" });

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/api/apis?search=geo`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockResponse);
    });

    it("fetches with category param", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchCatalog(createAbortSignal(), { category: "Finance" });

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/api/apis?category=Finance`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockResponse);
    });

    it("fetches with both search and category", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchCatalog(createAbortSignal(), { search: "geo", category: "Finance" });

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/api/apis?search=geo&category=Finance`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockResponse);
    });

    it("fetches without params when empty", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchCatalog(createAbortSignal(), {});

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/api/apis`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual(mockResponse);
    });

    it("omits empty string params", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchCatalog(createAbortSignal(), { search: "", category: "  " });

      expect(global.fetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/api/apis`,
        expect.any(Object)
      );
    });

    it("returns cached response on subsequent calls", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchCatalog(createAbortSignal(), { search: "geo" });
      (global.fetch as vi.Mock).mockClear();

      const result = await fetchCatalog(createAbortSignal(), { search: "geo" });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it("different params create different cache keys", async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchCatalog(createAbortSignal(), { search: "geo" });
      await fetchCatalog(createAbortSignal(), { search: "payment" });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("throws on non-ok response", async () => {
      (global.fetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      });

      await expect(fetchCatalog(createAbortSignal(), { search: "geo" })).rejects.toThrow(
        "Failed to fetch catalog: Not Found"
      );
    });

    it("aborts when signal is aborted", async () => {
      const controller = new AbortController();
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";

      (global.fetch as vi.Mock).mockRejectedValueOnce(abortError);

      const promise = fetchCatalog(controller.signal, { search: "geo" });
      controller.abort();

      await expect(promise).rejects.toThrow("Aborted");
    });
  });

  describe("clearCatalogCache", () => {
    it("removes all catalog cache keys", async () => {
      const mockResponse = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 12,
      };

      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchCatalog(createAbortSignal(), { search: "geo" });
      await fetchCatalog(createAbortSignal(), { category: "Finance" });

      expect(global.sessionStorage.getItem("callora-catalog-cache-search=geo")).toBeTruthy();
      expect(global.sessionStorage.getItem("callora-catalog-cache-category=Finance")).toBeTruthy();

      clearCatalogCache();

      expect(global.sessionStorage.getItem("callora-catalog-cache-search=geo")).toBeNull();
      expect(global.sessionStorage.getItem("callora-catalog-cache-category=Finance")).toBeNull();
    });
  });
});