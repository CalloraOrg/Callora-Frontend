// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COST_HEADER, runTestCall } from "./testCall";
import * as authService from "./authService";
import { _resetRefreshPromiseForTests } from "./authFetch";

function makeResponse(
  body: string,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {},
): Response {
  return new Response(body, {
    status: options.status ?? 200,
    headers: options.headers ?? { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  _resetRefreshPromiseForTests();
  vi.spyOn(authService, "getAccessToken").mockReturnValue("test-access-token");
  vi.spyOn(authService, "refreshAccessToken").mockResolvedValue("refreshed-token");
  vi.spyOn(authService, "signOut").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runTestCall", () => {
  it("returns parsed JSON, real status, latency, and cost from X-Callora-Cost header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse(JSON.stringify({ id: "u_42", active: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          [COST_HEADER]: "0.0025",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runTestCall({
      endpoint: { method: "POST", path: "/api/v1/transactions" },
      params: JSON.stringify({ amount: 10, currency: "USDC" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/transactions");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ amount: 10, currency: "USDC" }));
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-access-token",
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.httpStatus).toBe(200);
    expect(result.cost).toBe(0.0025);
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
    expect(result.body).toEqual({ id: "u_42", active: true });
  });

  it("defaults cost to 0 when the cost header is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await runTestCall({
      endpoint: { method: "GET", path: "/api/v1/user/profile" },
      params: "{}",
    });

    expect(result.ok).toBe(true);
    expect(result.cost).toBe(0);
  });

  it("sends query-string params and no body for GET requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await runTestCall({
      endpoint: { method: "GET", path: "/api/v1/user/profile" },
      params: JSON.stringify({ include: "stats", limit: 5 }),
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/user/profile?include=stats&limit=5");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("keeps plain text body when Content-Type is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse("OK: plain text payload", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await runTestCall({
      endpoint: { method: "GET", path: "/api/v1/user/profile" },
      params: "{}",
    });

    expect(result.ok).toBe(true);
    expect(result.body).toBe("OK: plain text payload");
  });

  it("maps 429 rate-limit responses to status: error with a safe generic message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse(
          JSON.stringify({
            detail: "Authorization: Bearer secret_token_123",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const result = await runTestCall({
      endpoint: { method: "GET", path: "/api/v1/user/profile" },
      params: "{}",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.httpStatus).toBe(429);
    expect(result.errorMessage).toMatch(/too many requests/i);
    expect(JSON.stringify(result.body)).not.toContain("secret_token_123");
    expect(JSON.stringify(result.body)).not.toContain("Authorization");
  });

  it("maps 500 server errors to status: error with a safe generic message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse("Internal stack trace with Bearer xyz", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await runTestCall({
      endpoint: { method: "POST", path: "/api/v1/transactions" },
      params: "{}",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.httpStatus).toBe(500);
    expect(result.errorMessage).toMatch(/server error/i);
    expect(JSON.stringify(result.body)).not.toContain("stack trace");
  });

  it("maps network rejections to status: error with httpStatus: null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const result = await runTestCall({
      endpoint: { method: "GET", path: "/api/v1/user/profile" },
      params: "{}",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.httpStatus).toBeNull();
    expect(result.cost).toBe(0);
    expect(result.errorMessage).toMatch(/network error/i);
  });

  it("re-throws AbortError when the request is aborted", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      }),
    );

    const promise = runTestCall({
      endpoint: { method: "GET", path: "/api/v1/user/profile" },
      params: "{}",
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("retries once on 401 via authFetch single-flight refresh", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(JSON.stringify({ error: "expired" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        makeResponse(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            [COST_HEADER]: "0.001",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runTestCall({
      endpoint: { method: "GET", path: "/api/v1/user/profile" },
      params: "{}",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
    const [, retryInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((retryInit.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer refreshed-token",
    );
    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.cost).toBe(0.001);
  });
});
