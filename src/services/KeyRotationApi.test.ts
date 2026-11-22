import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRotationToken, rotateKeyWithToken } from "./KeyRotationApi";
import type { RotationRequest } from "./KeyRotationService";

describe("KeyRotationApi", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

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

    it("handles network error gracefully without crashing", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const res = await getRotationToken("key-123", "bearer-token-abc");

      expect(res.token).toBeUndefined();
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe("NETWORK_ERROR");
      expect(res.error?.message).toMatch(/connection|network/i);
    });

    it("handles timeout error using fake timers", async () => {
      vi.useFakeTimers();
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      globalThis.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(abortError), 10000);
        });
      });

      const promise = getRotationToken("key-123", "bearer-token-abc");
      vi.advanceTimersByTime(10000);
      const res = await promise;

      expect(res.token).toBeUndefined();
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe("TIMEOUT");
      expect(res.error?.message).toMatch(/timed out/i);
    });
  });

  describe("rotateKeyWithToken", () => {
    const mockRequest: RotationRequest = {
      keyId: "api-test-key",
      confirmationToken: "opaque-server-token-456",
      context: {
        userId: "user-1",
        tenantId: "tenant-1",
        sessionId: "session-1",
        timestamp: Date.now(),
      },
    };

    it("calls POST /api/rotate-key with Idempotency-Key and returns new key", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          newKey: "ck_live_newly_minted_key_999",
        }),
      });

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

    it("handles 409 Conflict / replay error safely", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: "TOKEN_ALREADY_CONSUMED",
            message: "Token has already been used.",
          },
        }),
      });

      const res = await rotateKeyWithToken(mockRequest, "valid-bearer-token");

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.newKey).toBeUndefined();
    });
  });
});
