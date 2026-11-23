import { describe, expect, it, vi } from "vitest";
import {
  createHttpQuotaApi,
  createQuotaApi,
  QuotaConflictError,
  QuotaHttpError,
  QuotaValidationError,
} from "../api/quotaApi";

describe("createQuotaApi", () => {
  it("returns a default record for an unknown account", async () => {
    const api = createQuotaApi();
    const rec = await api.fetchQuota("unknown");
    expect(rec.value).toBe(0);
    expect(rec.version).toBe(1);
    expect(typeof rec.updatedAt).toBe("number");
  });

  it("seeds initial values", async () => {
    const api = createQuotaApi({ initial: { a: 10 } });
    const rec = await api.fetchQuota("a");
    expect(rec.value).toBe(10);
    expect(rec.version).toBe(1);
  });

  it("bumps the version on a successful update and persists it", async () => {
    const api = createQuotaApi({ initial: { a: 10 } });
    const before = await api.fetchQuota("a");
    const after = await api.updateQuota("a", 20, before.version);
    expect(after.value).toBe(20);
    expect(after.version).toBe(2);

    const refetched = await api.fetchQuota("a");
    expect(refetched.value).toBe(20);
    expect(refetched.version).toBe(2);
  });

  it("rejects an update based on a stale version with QuotaConflictError", async () => {
    const api = createQuotaApi({ initial: { a: 10 } });
    const v1 = await api.fetchQuota("a");
    await api.updateQuota("a", 20, v1.version); // -> v2

    await expect(api.updateQuota("a", 30, v1.version)).rejects.toBeInstanceOf(
      QuotaConflictError,
    );
  });

  it("rejects an aborted fetch with an AbortError", async () => {
    const api = createQuotaApi({ latencyMs: 50 });
    const controller = new AbortController();
    const promise = api.fetchQuota("a", controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});

function mockResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Response {
  const headerMap = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headerMap,
    json: async () => body,
  } as unknown as Response;
}

describe("createHttpQuotaApi", () => {
  it("fetches quota via GET /api/quota?accountId=... on 200", async () => {
    const record = {
      accountId: "acct 1",
      value: 500,
      version: 3,
      updatedAt: 1700000000000,
    };
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(200, record));
    const api = createHttpQuotaApi({ fetchImpl });

    const result = await api.fetchQuota("acct 1");

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/quota?accountId=acct%201",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(record);
  });

  it("updates quota via PUT /api/quota with JSON body on 200", async () => {
    const updated = {
      accountId: "acct-1",
      value: 1000,
      version: 4,
      updatedAt: 1700000005000,
    };
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(200, updated));
    const api = createHttpQuotaApi({ fetchImpl });

    const result = await api.updateQuota("acct-1", 1000, 3);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/quota",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "acct-1",
          value: 1000,
          baseVersion: 3,
        }),
      }),
    );
    expect(result).toEqual(updated);
  });

  it("maps HTTP 409 with serverVersion in JSON body to QuotaConflictError", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(mockResponse(409, { serverVersion: 7 }));
    const api = createHttpQuotaApi({ fetchImpl });

    await expect(api.updateQuota("acct-1", 200, 3)).rejects.toMatchObject({
      name: "QuotaConflictError",
      serverVersion: 7,
    });
    await expect(api.updateQuota("acct-1", 200, 3)).rejects.toBeInstanceOf(
      QuotaConflictError,
    );
  });

  it("maps HTTP 409 with ETag header when JSON body lacks version", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse(409, { error: "stale" }, { ETag: 'W/"9"' }),
    );
    const api = createHttpQuotaApi({ fetchImpl });

    await expect(api.updateQuota("acct-1", 200, 3)).rejects.toMatchObject({
      name: "QuotaConflictError",
      serverVersion: 9,
    });
  });

  it("maps HTTP 401 to a non-retryable client_error QuotaHttpError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(401, {}));
    const api = createHttpQuotaApi({ fetchImpl });

    await expect(api.fetchQuota("acct-1")).rejects.toMatchObject({
      name: "QuotaHttpError",
      status: 401,
      category: "client_error",
      retryable: false,
    });
    await expect(api.fetchQuota("acct-1")).rejects.toBeInstanceOf(
      QuotaHttpError,
    );
  });

  it("maps HTTP 500 to a retryable server_error QuotaHttpError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse(500, {}));
    const api = createHttpQuotaApi({ fetchImpl });

    await expect(api.updateQuota("acct-1", 100, 1)).rejects.toMatchObject({
      name: "QuotaHttpError",
      status: 500,
      category: "server_error",
      retryable: true,
    });
  });

  it("rejects malformed JSON with QuotaValidationError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);
    const api = createHttpQuotaApi({ fetchImpl });

    await expect(api.fetchQuota("acct-1")).rejects.toBeInstanceOf(
      QuotaValidationError,
    );
  });

  it("rejects invalid payload shapes (non-integer version / non-number value)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse(200, {
        accountId: "acct-1",
        value: "100",
        version: 1.5,
        updatedAt: Date.now(),
      }),
    );
    const api = createHttpQuotaApi({ fetchImpl });

    await expect(api.fetchQuota("acct-1")).rejects.toBeInstanceOf(
      QuotaValidationError,
    );
  });

  it("propagates AbortError without wrapping it", async () => {
    const abortErr = new DOMException("The operation was aborted.", "AbortError");
    const fetchImpl = vi.fn().mockRejectedValue(abortErr);
    const api = createHttpQuotaApi({ fetchImpl });

    await expect(api.fetchQuota("acct-1")).rejects.toMatchObject({
      name: "AbortError",
    });

    const controller = new AbortController();
    controller.abort();
    await expect(
      api.updateQuota("acct-1", 100, 1, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
