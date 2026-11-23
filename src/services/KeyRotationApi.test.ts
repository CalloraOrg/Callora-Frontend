import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRotationToken, rotateKeyWithToken } from "./KeyRotationApi";
import type { RotationRequest } from "./KeyRotationService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROTATION_TIMEOUT_MS = 30_000;

function makeMockRequest(overrides: Partial<RotationRequest> = {}): RotationRequest {
  return {
    keyId: "api-test-key",
    confirmationToken: "opaque-server-token-456",
    context: {
      userId: "user-1",
      tenantId: "tenant-1",
      sessionId: "session-1",
      timestamp: Date.now(),
    },
    ...overrides,
  };
}

function successFetch(newKey: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, newKey }),
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// getRotationToken
// ---------------------------------------------------------------------------

describe("getRotationToken", () => {
  it("returns server-issued token on successful 200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        token: "server-minted-token-xyz-123",
        expiresIn: 900,
      }),
    });

    const res = await getRotationToken("key-123", "bearer-token-abc");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/rotate-key/token",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer bearer-token-abc",
        },
        body: JSON.stringify({ keyId: "key-123" }),
      }),
    );

    expect(res.token).toBe("server-minted-token-xyz-123");
    expect(res.expiresIn).toBe(900);
    expect(res.error).toBeUndefined();
  });

  it("handles 403 Forbidden with safe error translation", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "FORBIDDEN", message: "You do not have permission." },
      }),
    });

    const res = await getRotationToken("key-123", "bearer-token-abc");

    expect(res.token).toBeUndefined();
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe("FORBIDDEN");
    expect(res.error?.message).toMatch(/permission/i);
  });

  it("handles 401 Unauthorized with safe error message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: "UNAUTHORIZED", message: "Session expired." },
      }),
    });

    const res = await getRotationToken("key-123", "bearer-token-abc");

    expect(res.token).toBeUndefined();
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe("UNAUTHORIZED");
    expect(res.error?.message).toMatch(/authorized/i);
  });

  it("handles non-OK response with malformed (non-JSON) body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      // .json() rejects when body is not valid JSON
      json: async () => { throw new SyntaxError("Unexpected token"); },
    });

    const res = await getRotationToken("key-123", "bearer-token-abc");

    expect(res.token).toBeUndefined();
    expect(res.error).toBeDefined();
    // Generic fallback code expected for 500
    expect(res.error?.code).toBeTruthy();
  });

  it("handles network error gracefully without crashing", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const res = await getRotationToken("key-123", "bearer-token-abc");

    expect(res.token).toBeUndefined();
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe("NETWORK_ERROR");
    expect(res.error?.message).toMatch(/connection|network/i);
  });

  it("handles AbortError (from AbortSignal.timeout) as a timeout", async () => {
    vi.useFakeTimers();
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    globalThis.fetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(abortError), 10_000);
      });
    });

    const promise = getRotationToken("key-123", "bearer-token-abc");
    vi.advanceTimersByTime(10_000);
    const res = await promise;

    expect(res.token).toBeUndefined();
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe("TIMEOUT");
    expect(res.error?.message).toMatch(/timed out/i);
  });

  it("handles a 200 response whose body is not JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("Not JSON"); },
    });

    // Should not throw; must return an error shape
    await expect(getRotationToken("key-123", "bearer-token-abc")).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// rotateKeyWithToken — success path
// ---------------------------------------------------------------------------

describe("rotateKeyWithToken — success path", () => {
  it("calls POST /api/rotate-key with Idempotency-Key and Authorization headers", async () => {
    const mockRequest = makeMockRequest();
    globalThis.fetch = successFetch("ck_live_newly_minted_key_999");

    const res = await rotateKeyWithToken(mockRequest, "valid-bearer-token");

    expect(res.success).toBe(true);
    expect(res.newKey).toBe("ck_live_newly_minted_key_999");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/rotate-key",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer valid-bearer-token",
          "Idempotency-Key": expect.any(String),
        }),
        body: JSON.stringify({
          keyId: mockRequest.keyId,
          confirmationToken: mockRequest.confirmationToken,
          context: mockRequest.context,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// rotateKeyWithToken — retry & idempotency key
// ---------------------------------------------------------------------------

describe("rotateKeyWithToken — retry carries the same Idempotency-Key", () => {
  it("retries once on a retryable 5xx and sends the same Idempotency-Key both times", async () => {
    vi.useFakeTimers();
    const mockRequest = makeMockRequest();

    // First call: 503 (retryable), second call: 200 (success)
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { code: "SERVICE_UNAVAILABLE" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, newKey: "ck_live_retry_key_111" }),
      });

    const promise = rotateKeyWithToken(mockRequest, "bearer-token");
    // Drain timers so the backoff delay resolves
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.success).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    const firstCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const secondCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1];

    const firstKey = (firstCall[1] as RequestInit).headers as Record<string, string>;
    const secondKey = (secondCall[1] as RequestInit).headers as Record<string, string>;

    // The idempotency key must be identical on both attempts
    expect(firstKey["Idempotency-Key"]).toBeTruthy();
    expect(firstKey["Idempotency-Key"]).toBe(secondKey["Idempotency-Key"]);
  });
});

// ---------------------------------------------------------------------------
// rotateKeyWithToken — non-retryable errors
// ---------------------------------------------------------------------------

describe("rotateKeyWithToken — non-retryable errors do not retry", () => {
  it("does not retry on a 403 (non-retryable authorization failure)", async () => {
    const mockRequest = makeMockRequest();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "AUTHORIZATION_FAILED", message: "Forbidden." },
      }),
    });

    const res = await rotateKeyWithToken(mockRequest, "bearer-token");

    expect(res.success).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry on a 409 replay (non-retryable)", async () => {
    const mockRequest = makeMockRequest();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: { code: "TOKEN_ALREADY_CONSUMED", message: "Token has already been used." },
      }),
    });

    const res = await rotateKeyWithToken(mockRequest, "bearer-token");

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.newKey).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// rotateKeyWithToken — timeout classification
// ---------------------------------------------------------------------------

describe("rotateKeyWithToken — timeout classification", () => {
  it('returns "exceeded its timeout" message when ROTATION_TIMEOUT_MS elapses', async () => {
    vi.useFakeTimers();
    const mockRequest = makeMockRequest();

    // fetch never resolves — it will be cancelled by runWithTimeout
    globalThis.fetch = vi.fn().mockImplementation(
      () => new Promise<Response>(() => { /* never settles */ }),
    );

    const promise = rotateKeyWithToken(mockRequest, "bearer-token");
    // Advance past ROTATION_TIMEOUT_MS plus the retry delay to exhaust both attempts
    await vi.advanceTimersByTimeAsync(ROTATION_TIMEOUT_MS * 3);
    const res = await promise;

    expect(res.success).toBe(false);
    expect(res.error?.message).toMatch(/exceeded its timeout/i);
  });
});

// ---------------------------------------------------------------------------
// rotateKeyWithToken — abort handling
// ---------------------------------------------------------------------------

describe("rotateKeyWithToken — abort handling", () => {
  it("maps an AbortError to ROTATION_FAILED with timeout message", async () => {
    const mockRequest = makeMockRequest();
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";

    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const res = await rotateKeyWithToken(mockRequest, "bearer-token");

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("ROTATION_FAILED");
    expect(res.error?.message).toMatch(/timeout|aborted/i);
  });
});

// ---------------------------------------------------------------------------
// rotateKeyWithToken — in-flight guard
// ---------------------------------------------------------------------------

describe("rotateKeyWithToken — in-flight guard", () => {
  it("two concurrent calls for the same keyId issue only a single fetch", async () => {
    const mockRequest = makeMockRequest({ keyId: "shared-key-id" });

    let resolveFirstFetch!: (value: Response) => void;
    const firstFetchPromise = new Promise<Response>((resolve) => {
      resolveFirstFetch = resolve;
    });

    globalThis.fetch = vi.fn().mockReturnValueOnce(firstFetchPromise);

    // Fire two concurrent rotations for the same keyId
    const p1 = rotateKeyWithToken(mockRequest, "bearer-token");
    const p2 = rotateKeyWithToken(mockRequest, "bearer-token");

    // Resolve the single in-flight fetch
    resolveFirstFetch({
      ok: true,
      status: 200,
      json: async () => ({ success: true, newKey: "ck_live_guard_key_42" }),
    } as Response);

    const [r1, r2] = await Promise.all([p1, p2]);

    // Only one actual network call, but both callers get the result
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.newKey).toBe("ck_live_guard_key_42");
    expect(r2.newKey).toBe("ck_live_guard_key_42");
  });

  it("two concurrent calls for DIFFERENT keyIds issue two separate fetches", async () => {
    const request1 = makeMockRequest({ keyId: "key-alpha" });
    const request2 = makeMockRequest({ keyId: "key-beta" });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, newKey: "ck_live_alpha" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, newKey: "ck_live_beta" }),
      });

    const [r1, r2] = await Promise.all([
      rotateKeyWithToken(request1, "bearer-token"),
      rotateKeyWithToken(request2, "bearer-token"),
    ]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(r1.newKey).toBe("ck_live_alpha");
    expect(r2.newKey).toBe("ck_live_beta");
  });
});
