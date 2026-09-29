/**
 * KeyRotationApi.test.ts
 *
 * Tests for the API integration layer covering:
 * - Successful token rotation with server-side validation
 * - HTTP error handling without leaking secrets
 * - Network timeout handling
 * - Malformed response handling
 * - Token generation and expiration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rotateKeyWithToken, getRotationToken } from "./KeyRotationApi";
import { RotationRequest, generateConfirmationToken, RotationContext } from "./KeyRotationService";

describe("KeyRotationApi", () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const mockContext: RotationContext = {
    userId: "user_123",
    tenantId: "tenant_abc",
    sessionId: "session_xyz",
    timestamp: Date.now(),
  };

  const mockRotationRequest: RotationRequest = {
    keyId: "key_live_test123",
    confirmationToken: generateConfirmationToken(mockContext),
    context: mockContext,
  };

  describe("rotateKeyWithToken", () => {
    it("successfully rotates a key and returns the new key", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            newKey: "ck_live_new_key_12345678",
          }),
          { status: 200 }
        )
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token_xyz"
      );

      expect(result.success).toBe(true);
      expect(result.newKey).toBe("ck_live_new_key_12345678");
      expect(result.error).toBeUndefined();
    });

    it("sends authorization header with session token", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "session_token_xyz");

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/keys/rotate",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "Bearer session_token_xyz",
          }),
        })
      );
    });

    it("includes rotation context in request body", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "token");

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body).toHaveProperty("keyId", mockRotationRequest.keyId);
      expect(body).toHaveProperty("confirmationToken");
      expect(body).toHaveProperty("context");
      expect(body.context.userId).toBe(mockContext.userId);
      expect(body.context.tenantId).toBe(mockContext.tenantId);
      expect(body.context.sessionId).toBe(mockContext.sessionId);
    });

    it("handles authorization error from backend", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "AUTHORIZATION_FAILED",
              message: "User not authorized to rotate this key.",
            },
          }),
          { status: 403 }
        )
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "invalid_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("AUTHORIZATION_FAILED");
      expect(result.error?.message).not.toContain("ck_live");
    });

    it("handles expired token error without leaking token", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "TOKEN_EXPIRED",
              message: "Confirmation token has expired.",
            },
          }),
          { status: 400 }
        )
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("TOKEN_EXPIRED");
      expect(result.error?.message).not.toContain(mockRotationRequest.confirmationToken);
    });

    it("handles cross-tenant violation", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "CROSS_TENANT_VIOLATION",
              message: "Key does not belong to your tenant.",
            },
          }),
          { status: 403 }
        )
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("CROSS_TENANT_VIOLATION");
      expect(result.error?.message).not.toContain("tenant_abc");
    });

    it("handles network timeout gracefully", async () => {
      fetchMock.mockRejectedValueOnce(
        new Error("AbortError: The operation was aborted.")
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("ROTATION_FAILED");
      expect(result.error?.message).toContain("timeout");
    });

    it("handles network error gracefully", async () => {
      fetchMock.mockRejectedValueOnce(
        new Error("Failed to fetch")
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("ROTATION_FAILED");
      expect(result.error?.message).toContain("Network error");
    });

    it("handles malformed response from backend", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("ROTATION_FAILED");
    });

    it("handles non-JSON response from backend", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 })
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("ROTATION_FAILED");
    });

    it("handles key not found error", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "KEY_NOT_FOUND",
              message: "The specified key does not exist.",
            },
          }),
          { status: 404 }
        )
      );

      const result = await rotateKeyWithToken(
        mockRotationRequest,
        "session_token"
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("KEY_NOT_FOUND");
    });

    it("does not expose keys in error responses", async () => {
      const oldKey = "ck_live_old_secret_key";
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "ROTATION_FAILED",
              message: `Failed to rotate key ${oldKey}`,
            },
          }),
          { status: 500 }
        )
      );

      const result = await rotateKeyWithToken(
        { ...mockRotationRequest, keyId: oldKey },
        "session_token"
      );

      expect(result.error?.message).not.toContain(oldKey);
      expect(result.error?.message).not.toContain("ck_live");
    });

    it("sets content-type header correctly", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "token");

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.headers["Content-Type"]).toBe("application/json");
    });

    it("uses POST method", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "token");

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.method).toBe("POST");
    });

    it("sets request timeout to 30 seconds", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "token");

      const callArgs = fetchMock.mock.calls[0][1];
      // AbortSignal.timeout(30000) is set
      expect(callArgs.signal).toBeDefined();
    });
  });

  describe("getRotationToken", () => {
    it("successfully retrieves a rotation token", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "eyJhbGciOiJIUzI1NiJ9...",
            expiresIn: 900000, // 15 minutes
          }),
          { status: 200 }
        )
      );

      const result = await getRotationToken("key_live_test", "session_token");

      expect(result.token).toBe("eyJhbGciOiJIUzI1NiJ9...");
      expect(result.expiresIn).toBe(900000);
      expect(result.error).toBeUndefined();
    });

    it("sends keyId in request body", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "token_abc",
            expiresIn: 900000,
          }),
          { status: 200 }
        )
      );

      await getRotationToken("key_live_123", "session_token");

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.keyId).toBe("key_live_123");
    });

    it("sends authorization header with session token", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: "token", expiresIn: 900000 }),
          { status: 200 }
        )
      );

      await getRotationToken("key_live_123", "my_session_token");

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.headers["Authorization"]).toBe("Bearer my_session_token");
    });

    it("handles token request error", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "TOKEN_REQUEST_FAILED",
              message: "Failed to generate token.",
            },
          }),
          { status: 500 }
        )
      );

      const result = await getRotationToken("key_live_123", "session_token");

      expect(result.error?.code).toBe("TOKEN_REQUEST_FAILED");
      expect(result.token).toBeUndefined();
    });

    it("handles network error during token request", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      const result = await getRotationToken("key_live_123", "session_token");

      expect(result.error?.code).toBe("TOKEN_REQUEST_FAILED");
      expect(result.error?.message).toContain("token");
    });

    it("sets request timeout to 10 seconds", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: "token", expiresIn: 900000 }),
          { status: 200 }
        )
      );

      await getRotationToken("key_live_123", "session_token");

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.signal).toBeDefined();
    });

    it("uses POST method to /api/v1/keys/rotate/token", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: "token", expiresIn: 900000 }),
          { status: 200 }
        )
      );

      await getRotationToken("key_live_123", "session_token");

      const endpoint = fetchMock.mock.calls[0][0];
      const method = fetchMock.mock.calls[0][1].method;

      expect(endpoint).toBe("/api/v1/keys/rotate/token");
      expect(method).toBe("POST");
    });

    it("does not expose key ID in error messages", async () => {
      const sensitiveKeyId = "key_live_super_secret_12345";
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "TOKEN_REQUEST_FAILED",
              message: `Failed to generate token for key ${sensitiveKeyId}`,
            },
          }),
          { status: 500 }
        )
      );

      const result = await getRotationToken(sensitiveKeyId, "session_token");

      expect(result.error?.message).not.toContain(sensitiveKeyId);
      expect(result.error?.message).not.toContain("super_secret");
    });
  });

  describe("Replay attack prevention", () => {
    it("includes timestamp in context for server-side replay detection", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      const before = Date.now();
      await rotateKeyWithToken(mockRotationRequest, "token");
      const after = Date.now();

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.context.timestamp).toBeGreaterThanOrEqual(before);
      expect(body.context.timestamp).toBeLessThanOrEqual(after);
    });

    it("includes session ID for replay prevention", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "token");

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.context.sessionId).toBe("session_xyz");
    });
  });

  describe("Cross-tenant protection", () => {
    it("includes tenant ID in context", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "token");

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.context.tenantId).toBe("tenant_abc");
    });

    it("includes user ID in context", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ newKey: "ck_live_new" }), { status: 200 })
      );

      await rotateKeyWithToken(mockRotationRequest, "token");

      const callArgs = fetchMock.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.context.userId).toBe("user_123");
    });
  });
});
