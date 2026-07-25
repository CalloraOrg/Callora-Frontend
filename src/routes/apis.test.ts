// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { handleApisRoute } from "./apis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRequest(url: string, ifNoneMatch?: string): Request {
  return {
    url,
    headers: {
      "if-none-match": ifNoneMatch,
    },
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Successful response
// ---------------------------------------------------------------------------

describe("handleApisRoute — success", () => {
  it("returns 200 with JSON body and ETag", async () => {
    const res = await handleApisRoute(mockRequest("http://localhost/api/apis"));
    expect(res.status).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/json");
    expect(res.headers["ETag"]).toBeTruthy();
  });

  it("wraps payload in { ok: true, data } envelope", async () => {
    const res = await handleApisRoute(mockRequest("http://localhost/api/apis"));
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("includes a correlation ID on success responses", async () => {
    const res = await handleApisRoute(mockRequest("http://localhost/api/apis"));
    const body = JSON.parse(res.body);
    expect(body.correlationId).toBeTruthy();
    expect(body.correlationId.length).toBe(16);
    expect(res.headers["X-Correlation-Id"]).toBe(body.correlationId);
  });

  it("different requests get different correlation IDs", async () => {
    const res1 = await handleApisRoute(
      mockRequest("http://localhost/api/apis"),
    );
    const res2 = await handleApisRoute(
      mockRequest("http://localhost/api/apis"),
    );
    const body1 = JSON.parse(res1.body);
    const body2 = JSON.parse(res2.body);
    expect(body1.correlationId).not.toBe(body2.correlationId);
  });
});

// ---------------------------------------------------------------------------
// ETag / 304 Not Modified
// ---------------------------------------------------------------------------

describe("handleApisRoute — conditional GET", () => {
  it("returns 304 when If-None-Match matches current ETag", async () => {
    const url = "http://localhost/api/apis";
    const first = await handleApisRoute(mockRequest(url));
    const eTag = first.headers["ETag"];
    expect(eTag).toBeTruthy();

    const second = await handleApisRoute(mockRequest(url, eTag));
    expect(second.status).toBe(304);
  });

  it("returns 200 when If-None-Match does not match", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis", '"wrongetag"'),
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 when If-None-Match uses weak comparison (W/ prefix)", async () => {
    const first = await handleApisRoute(
      mockRequest("http://localhost/api/apis"),
    );
    const eTag = first.headers["ETag"];
    const weakETag = eTag ? `W/${eTag}` : 'W/"abc"';
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis", weakETag),
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 when If-None-Match header is absent", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis", undefined),
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("handleApisRoute — input validation", () => {
  it("returns 400 for an empty category parameter", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?category="),
    );
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_CATEGORY");
  });

  it("returns 400 for an invalid status parameter", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?status=invalid"),
    );
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("accepts status=operational", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?status=operational"),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
  });

  it("accepts status=DEGRADED (case-insensitive)", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?status=DEGRADED"),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
  });

  it("accepts status=maintenance", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?status=maintenance"),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe("handleApisRoute — filtering", () => {
  it("filters by category when category param is provided", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?category=Fintech"),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    for (const api of body.data) {
      expect(api.category?.toLowerCase()).toBe("fintech");
    }
  });

  it("filters by status when status param is provided", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?status=operational"),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    for (const api of body.data) {
      expect(api.status).toBe("operational");
    }
  });

  it("filters by search term against name and description", async () => {
    const res = await handleApisRoute(
      mockRequest("http://localhost/api/apis?search=Weather"),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    for (const api of body.data) {
      const haystack = `${api.name} ${api.description}`.toLowerCase();
      expect(haystack).toContain("weather");
    }
  });

  it("applies multiple filters simultaneously", async () => {
    const res = await handleApisRoute(
      mockRequest(
        "http://localhost/api/apis?category=Fintech&status=operational",
      ),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    for (const api of body.data) {
      expect(api.category?.toLowerCase()).toBe("fintech");
      expect(api.status).toBe("operational");
    }
  });

  it("returns all APIs when no filters are applied", async () => {
    const allRes = await handleApisRoute(
      mockRequest("http://localhost/api/apis"),
    );
    const allBody = JSON.parse(allRes.body);
    const allCount = allBody.data.length;
    expect(allCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

describe("handleApisRoute — response headers", () => {
  it("sets X-Correlation-Id header", async () => {
    const res = await handleApisRoute(mockRequest("http://localhost/api/apis"));
    expect(res.headers["X-Correlation-Id"]).toBeTruthy();
    expect(res.headers["X-Correlation-Id"].length).toBe(16);
  });

  it("sets Content-Type to application/json", async () => {
    const res = await handleApisRoute(mockRequest("http://localhost/api/apis"));
    expect(res.headers["Content-Type"]).toBe("application/json");
  });
});
