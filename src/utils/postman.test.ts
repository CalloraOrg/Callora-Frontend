import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildPostmanCollection,
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
