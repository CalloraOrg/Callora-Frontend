import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError, isApiAbortError, isApiError } from "./apiClient";
import * as authFetchModule from "../services/authFetch";
import * as constantsConfig from "../config/constants";
import { isTimeoutError } from "../services/idempotency";

describe("apiClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(constantsConfig, "apiUrl").mockImplementation((p: string) => p.startsWith("/") ? p : `/${p}`);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("encodes query parameters, skipping null/undefined, and handles relative paths", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    const result = await apiClient.get<{ ok: boolean }>("/api/apis", {
      auth: false,
      query: { search: "geo", page: 2, active: true, skipNull: null, skipUndef: undefined },
    });

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/apis?search=geo&page=2&active=true",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("handles absolute baseUrl with trailing slashes and appends query with & if needed", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    await apiClient.get("api/items?existing=1", {
      auth: false,
      baseUrl: "https://api.example.com///",
      query: { limit: 10 },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/api/items?existing=1&limit=10",
      expect.any(Object),
    );
  });

  it("uses apiUrl when configured and auth is false", async () => {
    vi.spyOn(constantsConfig, "apiUrl").mockImplementation((p: string) => `https://backend.callora.dev${p.startsWith("/") ? p : `/${p}`}`);
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    await apiClient.get("/api/ping", { auth: false });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://backend.callora.dev/api/ping",
      expect.any(Object),
    );
  });

  it("routes authenticated requests through authFetch by default", async () => {
    const authFetchSpy = vi.spyOn(authFetchModule, "authFetch").mockResolvedValue(
      new Response(JSON.stringify({ user: "alice" }), { status: 200 }),
    );
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const data = await apiClient.get<{ user: string }>("/api/me");

    expect(data).toEqual({ user: "alice" });
    expect(authFetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("supports post, put, and delete with JSON body serialization", async () => {
    const fetchSpy = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ saved: true }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy;

    await apiClient.post("/api/keys", { auth: false, body: { name: "prod" } });
    await apiClient.put("/api/keys/1", { auth: false, body: { name: "staging" } });
    await apiClient.delete("/api/keys/1", { auth: false });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "/api/keys",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "prod" }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/keys/1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      "/api/keys/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("handles 204 No Content and empty bodies without throwing", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(apiClient.delete("/api/item/1", { auth: false })).resolves.toBeUndefined();
    await expect(apiClient.get("/api/empty", { auth: false })).resolves.toBeUndefined();
  });

  it("throws ApiError with INVALID_RESPONSE when 200 body is non-JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("<html>not json</html>", { status: 200 }),
    );

    await expect(apiClient.get("/api/broken", { auth: false })).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      code: "INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("maps 4xx and 5xx responses using classifyHttpError and redacts sensitive tokens", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: "Denied for Bearer secret-token-123",
            },
          }),
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Slow down" }), { status: 429 }),
      )
      .mockResolvedValueOnce(new Response("", { status: 503 }));

    try {
      await apiClient.get("/api/secret", { auth: false });
      expect.unreachable("should throw");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe("FORBIDDEN");
      expect(apiErr.retryable).toBe(false);
      expect(apiErr.message).not.toContain("secret-token-123");
      expect(apiErr.message).toContain("[REDACTED_TOKEN]");
    }

    await expect(apiClient.get("/api/rate", { auth: false })).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      retryable: true,
    });

    await expect(apiClient.get("/api/down", { auth: false })).rejects.toMatchObject({
      status: 503,
      code: "SERVER_ERROR",
      retryable: true,
    });
  });

  it("times out using runWithTimeout when timeoutMs elapses", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const promise = apiClient.get("/api/slow", { auth: false, timeoutMs: 250 });
    const assertion = expect(promise).rejects.toSatisfy((err: unknown) => isTimeoutError(err));
    await vi.advanceTimersByTimeAsync(250);
    await assertion;
  });

  it("propagates pre-aborted and mid-flight AbortSignal as AbortError", async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    await expect(
      apiClient.get("/api/pre-abort", { auth: false, signal: preAborted.signal }),
    ).rejects.toSatisfy((err: unknown) => isApiAbortError(err));

    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const pending = apiClient.get("/api/mid-abort", {
      auth: false,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toSatisfy((err: unknown) => isApiAbortError(err));
  });

  it("runs optional parse validator and propagates validator errors", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ n: 5 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ n: "bad" }), { status: 200 }));

    const parsed = await apiClient.get<number>("/api/num", {
      auth: false,
      parse: (raw) => (raw as { n: number }).n * 2,
    });
    expect(parsed).toBe(10);

    await expect(
      apiClient.get<number>("/api/num", {
        auth: false,
        parse: () => {
          throw new Error("Validation failed");
        },
      }),
    ).rejects.toThrow("Validation failed");
  });
});
