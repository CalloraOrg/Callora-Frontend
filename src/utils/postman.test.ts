import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildPostmanCollection,
  buildPostmanApiCollection,
  getPostmanImportUrl,
  buildInsomniaRequest,
  getInsomniaImportUrl,
  copyToClipboard,
} from "./postman";

const BASE_URL = "https://api.callora.com";

describe("buildPostmanCollection", () => {
  it("builds a valid Postman collection for a GET endpoint", () => {
    const result = buildPostmanCollection("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    expect(result).toHaveProperty("info.name", "Get Forecast");
    expect(result).toHaveProperty(
      "info.schema",
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    );
    expect(result).toHaveProperty("item[0].name", "Get Forecast");
    expect(result).toHaveProperty("item[0].request.method", "GET");
    expect(result).toHaveProperty(
      "item[0].request.url.raw",
      "https://api.callora.com/v1/forecast",
    );
  });

  it("builds a valid Postman collection for a POST endpoint", () => {
    const result = buildPostmanCollection("POST", "/v1/data", "Create Data", BASE_URL);

    expect(result).toHaveProperty("item[0].request.method", "POST");
    expect(result).toHaveProperty(
      "item[0].request.url.raw",
      "https://api.callora.com/v1/data",
    );
  });

  it("handles a base URL without trailing slash", () => {
    const result = buildPostmanCollection("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    const raw = (result as any).item[0].request.url.raw;
    expect(raw).not.toContain("//v1");
    expect(raw).toBe("https://api.callora.com/v1/forecast");
  });

  it("parses host and path correctly", () => {
    const result = buildPostmanCollection("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    expect(result).toHaveProperty("item[0].request.url.host", [
      "api",
      "callora",
      "com",
    ]);
    expect(result).toHaveProperty("item[0].request.url.path", [
      "v1",
      "forecast",
    ]);
  });

  it("handles http base URL", () => {
    const result = buildPostmanCollection("GET", "/test", "Test", "http://localhost:3000");

    expect(result).toHaveProperty("item[0].request.url.protocol", "http");
    expect(result).toHaveProperty(
      "item[0].request.url.raw",
      "http://localhost:3000/test",
    );
  });
});

describe("getPostmanImportUrl", () => {
  it("returns a postman.com import URL", () => {
    const url = getPostmanImportUrl("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    expect(url).toMatch(/^https:\/\/www\.postman\.com\/collection\/import\?collection=/);
  });

  it("includes base64-encoded collection data", () => {
    const url = getPostmanImportUrl("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    const encoded = url.split("?collection=")[1];
    expect(encoded).toBeTruthy();
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = JSON.parse(
      decodeURIComponent(atob(encoded)),
    );
    expect(decoded).toHaveProperty("info.name", "Get Forecast");
    expect(decoded).toHaveProperty("item[0].request.method", "GET");
  });
});

describe("buildInsomniaRequest", () => {
  it("builds a valid Insomnia request resource for a GET endpoint", () => {
    const result = buildInsomniaRequest("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    expect(result).toHaveProperty("_type", "request");
    expect(result).toHaveProperty("name", "Get Forecast");
    expect(result).toHaveProperty("method", "GET");
    expect(result).toHaveProperty(
      "url",
      "https://api.callora.com/v1/forecast",
    );
  });

  it("preserves HTTP method case", () => {
    const result = buildInsomniaRequest("post", "/v1/data", "Create Data", BASE_URL);

    expect(result).toHaveProperty("method", "POST");
  });
});

describe("getInsomniaImportUrl", () => {
  it("returns an insomnia:// import URL", () => {
    const url = getInsomniaImportUrl("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    expect(url).toMatch(/^insomnia:\/\/import\/data\?data=/);
  });

  it("includes base64-encoded request data", () => {
    const url = getInsomniaImportUrl("GET", "/v1/forecast", "Get Forecast", BASE_URL);

    const encoded = url.split("?data=")[1];
    expect(encoded).toBeTruthy();
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = JSON.parse(
      decodeURIComponent(atob(encoded)),
    );
    expect(decoded).toHaveProperty("_type", "request");
    expect(decoded).toHaveProperty("method", "GET");
  });
});

describe("copyToClipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses navigator.clipboard.writeText when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const result = await copyToClipboard("hello");
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false when clipboard API fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const result = await copyToClipboard("hello");
    expect(result).toBe(false);
  });

  it("falls back to execCommand when clipboard API is missing", async () => {
    Object.assign(navigator, { clipboard: undefined });

    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard("fallback test");
    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});

describe("buildPostmanApiCollection", () => {
  it("builds a Postman v2.1 collection with folders from groups and baseUrl variable", () => {
    const result = buildPostmanApiCollection({
      name: "Weather API",
      baseUrl: "https://api.callora.com/",
      endpoints: [
        { method: "get", path: "/v1/forecast", name: "Get Forecast", group: "Forecast" },
        { method: "post", path: "/v1/alerts", name: "Create Alert", group: "Alerts" },
        { method: "delete", path: "/v1/alerts/1", name: "Delete Alert", group: "Alerts" },
      ],
    });

    expect(result.info).toEqual({
      name: "Weather API",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    });
    expect(result.variable).toEqual([
      { key: "baseUrl", value: "https://api.callora.com" },
    ]);

    expect(result.item).toHaveLength(2);
    const forecastFolder = result.item[0] as any;
    const alertsFolder = result.item[1] as any;

    expect(forecastFolder.name).toBe("Forecast");
    expect(forecastFolder.item).toHaveLength(1);
    expect(forecastFolder.item[0].name).toBe("Get Forecast");
    expect(forecastFolder.item[0].request.method).toBe("GET");
    expect(forecastFolder.item[0].request.url).toEqual({
      raw: "{{baseUrl}}/v1/forecast",
      host: ["{{baseUrl}}"],
      path: ["v1", "forecast"],
    });

    expect(alertsFolder.name).toBe("Alerts");
    expect(alertsFolder.item).toHaveLength(2);
    expect(alertsFolder.item[0].request.method).toBe("POST");
    expect(alertsFolder.item[1].request.method).toBe("DELETE");
  });

  it("falls back to a single flat list when endpoints are ungrouped", () => {
    const result = buildPostmanApiCollection({
      name: "Simple API",
      baseUrl: BASE_URL,
      endpoints: [
        { method: "get", path: "/v1/ping", name: "Ping" },
        { method: "post", path: "/v1/echo", name: "Echo" },
      ],
    });

    expect(result.item).toHaveLength(2);
    expect((result.item[0] as any).item).toBeUndefined();
    expect((result.item[0] as any).name).toBe("Ping");
    expect((result.item[0] as any).request.url.raw).toBe("{{baseUrl}}/v1/ping");
    expect((result.item[1] as any).name).toBe("Echo");
  });

  it("sanitises empty names and de-duplicates request names within each folder", () => {
    const result = buildPostmanApiCollection({
      name: "   ",
      baseUrl: BASE_URL,
      endpoints: [
        { method: "get", path: "/v1/items", name: "  ", group: "Items" },
        { method: "get", path: "/v1/items", name: "List Items", group: "Items" },
        { method: "post", path: "/v1/items", name: "List Items", group: "Items" },
        { method: "put", path: "/v1/items", name: "List Items", group: "Items" },
        { method: "get", path: "/v1/other", name: "List Items", group: "Other" },
      ],
    });

    expect(result.info.name).toBe("API Collection");
    const itemsFolder = result.item[0] as any;
    const otherFolder = result.item[1] as any;

    expect(itemsFolder.item.map((req: any) => req.name)).toEqual([
      "GET /v1/items",
      "List Items",
      "List Items (2)",
      "List Items (3)",
    ]);
    // Same name in a different folder should not be suffixed
    expect(otherFolder.item[0].name).toBe("List Items");
  });

  it("handles an empty endpoints list", () => {
    const result = buildPostmanApiCollection({
      name: "Empty API",
      baseUrl: BASE_URL,
      endpoints: [],
    });

    expect(result.info.name).toBe("Empty API");
    expect(result.variable).toEqual([{ key: "baseUrl", value: BASE_URL }]);
    expect(result.item).toEqual([]);
  });
});
