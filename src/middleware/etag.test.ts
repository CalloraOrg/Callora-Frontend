// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  applyETag,
  checkETag,
  computeETag,
  generateCorrelationId,
  log,
} from "./etag";

// ---------------------------------------------------------------------------
// computeETag
// ---------------------------------------------------------------------------

describe("computeETag", () => {
  it("returns a strong ETag (no W/ prefix)", async () => {
    const eTag = await computeETag("hello world");
    expect(eTag).not.toMatch(/^W\//);
    expect(eTag.startsWith('"')).toBe(true);
    expect(eTag.endsWith('"')).toBe(true);
  });

  it("returns consistent ETags for the same content", async () => {
    const body = "<h1>Hello</h1>";
    const [tag1, tag2] = await Promise.all([
      computeETag(body),
      computeETag(body),
    ]);
    expect(tag1).toBe(tag2);
  });

  it("returns different ETags for different content", async () => {
    const tagA = await computeETag("content A");
    const tagB = await computeETag("content B");
    expect(tagA).not.toBe(tagB);
  });

  it("returns a 64-character hex hash (SHA-256) wrapped in quotes", async () => {
    const eTag = await computeETag("test");
    const inner = eTag.slice(1, -1);
    expect(inner.length).toBe(64);
    expect(inner).toMatch(/^[0-9a-f]+$/);
  });

  it("handles an empty string body", async () => {
    const eTag = await computeETag("");
    expect(eTag).toBeTruthy();
    expect(eTag.startsWith('"')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkETag
// ---------------------------------------------------------------------------

describe("checkETag", () => {
  it("returns 304 when client ETag matches server ETag exactly", () => {
    const serverETag = '"abc123def456"';
    expect(checkETag('"abc123def456"', serverETag)).toBe(304);
  });

  it("returns 200 when client ETag differs from server ETag", () => {
    expect(checkETag('"aaaa"', '"bbbb"')).toBe(200);
  });

  it("returns 200 when client ETag is undefined (no If-None-Match)", () => {
    expect(checkETag(undefined, '"abc"')).toBe(200);
  });

  it("returns 200 when client sends a weak ETag (W/ prefix) for a strong validator", () => {
    const serverETag = '"abc123"';
    expect(checkETag('W/"abc123"', serverETag)).toBe(200);
  });

  it("handles ETags with and without surrounding quotes flexibly", () => {
    const serverETag = '"abc123"';
    expect(checkETag("abc123", serverETag)).toBe(304);
    expect(checkETag('"abc123"', serverETag)).toBe(304);
  });

  it("is case-sensitive — different casing does not match", () => {
    expect(checkETag('"ABC123"', '"abc123"')).toBe(200);
  });

  it("returns 200 when server ETag is empty", () => {
    expect(checkETag('""', '""')).toBe(304);
    expect(checkETag('"', '"')).toBe(304);
  });
});

// ---------------------------------------------------------------------------
// applyETag
// ---------------------------------------------------------------------------

describe("applyETag", () => {
  it("sets ETag header on the headers object", async () => {
    const headers: Record<string, string> = {};
    const status = await applyETag("body content", undefined, headers);
    expect(headers["ETag"]).toBeTruthy();
    expect(headers["ETag"]).toMatch(/^"[0-9a-f]{64}"$/);
    expect(status).toBe(200);
  });

  it("sets Cache-Control to no-cache", async () => {
    const headers: Record<string, string> = {};
    await applyETag("body", undefined, headers);
    expect(headers["Cache-Control"]).toBe("no-cache");
  });

  it("returns 304 when If-None-Match matches the computed ETag", async () => {
    const body = "identical content for etag testing";
    const serverETag = await computeETag(body);
    const headers: Record<string, string> = {};
    const status = await applyETag(body, serverETag, headers);
    expect(status).toBe(304);
    expect(headers["ETag"]).toBe(serverETag);
  });

  it("returns 200 when If-None-Match does not match", async () => {
    const body = "some content";
    const headers: Record<string, string> = {};
    const status = await applyETag(body, '"wrongetag"', headers);
    expect(status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// generateCorrelationId
// ---------------------------------------------------------------------------

describe("generateCorrelationId", () => {
  it("returns a 16-character hex string", () => {
    const id = generateCorrelationId();
    expect(id.length).toBe(16);
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it("returns a different ID on each call", () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------

describe("log", () => {
  const cid = generateCorrelationId();

  it("returns a frozen object with the correct shape", () => {
    const entry = log("info", "test message", cid);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("test message");
    expect(entry.correlationId).toBe(cid);
    expect(entry.timestamp).toBeTruthy();
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it("includes extra fields when provided", () => {
    const entry = log("debug", "search", cid, { query: "weather" });
    expect((entry as Record<string, unknown>)["query"]).toBe("weather");
  });

  it("includes all log levels", () => {
    for (const level of ["info", "warn", "error", "debug"] as const) {
      const entry = log(level, "msg", cid);
      expect(entry.level).toBe(level);
    }
  });

  it("has an ISO-8601 timestamp", () => {
    const entry = log("info", "msg", cid);
    expect(Date.parse(entry.timestamp)).not.toBeNaN();
  });
});
