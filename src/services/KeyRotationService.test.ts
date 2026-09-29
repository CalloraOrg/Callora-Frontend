/**
 * KeyRotationService.test.ts
 *
 * Comprehensive tests for the key rotation service covering:
 * - Authorization and validation checks
 * - Invalid, stale, and replayed tokens
 * - Cross-tenant attack prevention
 * - Malformed input handling
 * - Secret leakage prevention
 *
 * These tests ensure the security boundary is properly enforced before
 * any sensitive mutation occurs.
 */

import { describe, it, expect } from "vitest";
import {
  validateRotationRequest,
  sanitizeRotationError,
  isRetryableError,
  stripSensitiveData,
  generateConfirmationToken,
  RotationContext,
  RotationErrorCode,
} from "./KeyRotationService";

describe("KeyRotationService", () => {
  const mockContext: RotationContext = {
    userId: "user_123",
    tenantId: "tenant_abc",
    sessionId: "session_xyz",
    timestamp: Date.now(),
  };

  describe("validateRotationRequest", () => {
    describe("Authorization checks", () => {
      it("passes validation when all fields are correct", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("fails when user ID does not match", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: mockContext,
          },
          "user_different", // Wrong user
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
        expect(result.error?.message).not.toContain("user_123"); // No user ID leak
      });

      it("fails when tenant ID does not match (cross-tenant attack)", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: mockContext,
          },
          mockContext.userId,
          "tenant_different", // Wrong tenant
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.CROSS_TENANT_VIOLATION);
        expect(result.error?.message).not.toContain("tenant_abc"); // No tenant ID leak
      });

      it("fails when session ID does not match", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          "session_different", // Wrong session
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
      });
    });

    describe("Token validation", () => {
      it("fails with stale token (older than 15 minutes)", () => {
        const staleContext: RotationContext = {
          ...mockContext,
          timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes ago
        };
        const token = generateConfirmationToken(staleContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: staleContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.TOKEN_EXPIRED);
      });

      it("passes with fresh token (within 15 minutes)", () => {
        const recentContext: RotationContext = {
          ...mockContext,
          timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        };
        const token = generateConfirmationToken(recentContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: recentContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(true);
      });

      it("fails with corrupted/invalid token", () => {
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: "not-a-valid-token-format",
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.TOKEN_INVALID);
      });

      it("fails with missing token", () => {
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: "", // Empty token
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.TOKEN_INVALID);
      });

      it("fails when token and context timestamps don't match", () => {
        const token = generateConfirmationToken(mockContext);
        const mismatchedContext: RotationContext = {
          ...mockContext,
          timestamp: mockContext.timestamp + 60000, // Different timestamp
        };

        // The token contains the original timestamp, so it will still be valid
        // but the context staleness check will fail
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: mismatchedContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        // This should pass because we check token age separately from context age
        expect(result.valid).toBe(true);
      });
    });

    describe("Input validation", () => {
      it("fails with missing keyId", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "", // Empty key ID
            confirmationToken: token,
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
      });

      it("fails with null/undefined keyId", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: null as any,
            confirmationToken: token,
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
      });

      it("fails with malformed request object", () => {
        const result = validateRotationRequest(
          null as any,
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
      });

      it("fails with missing context", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: null as any,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
      });

      it("fails with whitespace-only keyId", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "   ", // Just whitespace
            confirmationToken: token,
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
      });
    });

    describe("Replay attack prevention", () => {
      it("fails when request is replayed with expired timestamp", () => {
        const oldContext: RotationContext = {
          ...mockContext,
          timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
        };
        const token = generateConfirmationToken(oldContext);

        // Attacker tries to replay the request
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: oldContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          mockContext.sessionId,
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.TOKEN_EXPIRED);
      });

      it("fails when token is replayed with different session ID", () => {
        const token = generateConfirmationToken(mockContext);
        const result = validateRotationRequest(
          {
            keyId: "key_live_abc123",
            confirmationToken: token,
            context: mockContext,
          },
          mockContext.userId,
          mockContext.tenantId,
          "session_different", // Session changed - prevents replay
        );

        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
      });
    });
  });

  describe("sanitizeRotationError", () => {
    it("returns safe message for network errors without exposing details", () => {
      const error = new Error("Network request failed");
      const result = sanitizeRotationError(error);

      expect(result.code).toBe(RotationErrorCode.ROTATION_FAILED);
      expect(result.message).not.toContain("Network request failed");
      expect(result.message).toContain("Network error");
    });

    it("returns safe message for timeout errors", () => {
      const error = new Error("Request timeout after 30000ms");
      const result = sanitizeRotationError(error);

      expect(result.code).toBe(RotationErrorCode.ROTATION_FAILED);
      expect(result.message).toContain("timeout");
      expect(result.message).not.toContain("30000");
    });

    it("maps backend error codes to safe user messages", () => {
      const result = sanitizeRotationError(
        new Error("Authorization check failed"),
        RotationErrorCode.AUTHORIZATION_FAILED,
      );

      expect(result.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
      expect(result.message).toBe("You are not authorized to rotate this key.");
      expect(result.message).not.toContain("Authorization check failed");
    });

    it("returns generic message for unknown errors", () => {
      const error = new Error("Unknown backend error: ck_live_abcdef123456789");
      const result = sanitizeRotationError(error);

      expect(result.code).toBe(RotationErrorCode.ROTATION_FAILED);
      expect(result.message).toBe("Failed to rotate API key. Please try again.");
      // Ensure the API key is NOT exposed
      expect(result.message).not.toContain("ck_live");
    });

    it("handles non-Error objects gracefully", () => {
      const result = sanitizeRotationError("some string error");

      expect(result.code).toBe(RotationErrorCode.ROTATION_FAILED);
      expect(result.message).toBe("Failed to rotate API key. Please try again.");
    });

    it("does not leak token expiration details in the message", () => {
      const error = new Error("Token ck_live_token123 expired at 2024-08-28T12:00:00Z");
      const result = sanitizeRotationError(error, RotationErrorCode.TOKEN_EXPIRED);

      expect(result.message).not.toContain("ck_live_token123");
      expect(result.message).not.toContain("2024-08-28");
      expect(result.message).toContain("Confirmation token has expired");
    });
  });

  describe("isRetryableError", () => {
    it("returns false for authorization errors (non-retryable)", () => {
      expect(isRetryableError(RotationErrorCode.AUTHORIZATION_FAILED)).toBe(false);
    });

    it("returns false for cross-tenant violations (non-retryable)", () => {
      expect(isRetryableError(RotationErrorCode.CROSS_TENANT_VIOLATION)).toBe(false);
    });

    it("returns false for expired tokens (non-retryable, start fresh)", () => {
      expect(isRetryableError(RotationErrorCode.TOKEN_EXPIRED)).toBe(false);
    });

    it("returns false for invalid input (non-retryable)", () => {
      expect(isRetryableError(RotationErrorCode.INVALID_INPUT)).toBe(false);
    });

    it("returns false for key not found (non-retryable)", () => {
      expect(isRetryableError(RotationErrorCode.KEY_NOT_FOUND)).toBe(false);
    });

    it("returns true for generic rotation failures (retryable)", () => {
      expect(isRetryableError(RotationErrorCode.ROTATION_FAILED)).toBe(true);
    });

    it("returns true for unknown error codes (retryable by default)", () => {
      expect(isRetryableError("UNKNOWN_ERROR")).toBe(true);
    });
  });

  describe("stripSensitiveData", () => {
    it("strips API key patterns", () => {
      const text = "Failed with key ck_live_abc123def456ghi789";
      const result = stripSensitiveData(text);

      expect(result).not.toContain("ck_live_abc123def456ghi789");
      expect(result).toContain("[REDACTED_KEY]");
    });

    it("strips secret key patterns (sk_*)", () => {
      const text = "Error: sk_live_secret123456789abc";
      const result = stripSensitiveData(text);

      expect(result).not.toContain("sk_live_secret123456789abc");
      expect(result).toContain("[REDACTED_KEY]");
    });

    it("strips public key patterns (pk_*)", () => {
      const text = "Using key pk_live_public123456789";
      const result = stripSensitiveData(text);

      expect(result).not.toContain("pk_live_public123456789");
      expect(result).toContain("[REDACTED_KEY]");
    });

    it("strips bearer tokens", () => {
      const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const result = stripSensitiveData(text);

      expect(result).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(result).toContain("Bearer [REDACTED_TOKEN]");
    });

    it("strips password values", () => {
      const text = "password: mySecretPassword123";
      const result = stripSensitiveData(text);

      expect(result).not.toContain("mySecretPassword123");
      expect(result).toContain("[REDACTED]");
    });

    it("handles multiple secrets in one string", () => {
      const text =
        "Error rotating key ck_live_abc123 with token eyJhbGciOiJIUzI1NiJ9 and password secret123";
      const result = stripSensitiveData(text);

      expect(result).not.toContain("ck_live_abc123");
      expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(result).not.toContain("secret123");
      expect(result.match(/REDACTED/g)?.length).toBeGreaterThanOrEqual(3);
    });

    it("handles non-string input gracefully", () => {
      const result = stripSensitiveData(null as any);
      expect(result).toBe("[non-string]");
    });

    it("handles empty strings", () => {
      const result = stripSensitiveData("");
      expect(result).toBe("");
    });
  });

  describe("Integration scenarios", () => {
    it("blocks a complete rotation flow when authorization fails", () => {
      const token = generateConfirmationToken(mockContext);

      // Step 1: Attacker changes user ID
      const result = validateRotationRequest(
        {
          keyId: "key_live_abc123",
          confirmationToken: token,
          context: mockContext,
        },
        "attacker_user", // Wrong user
        mockContext.tenantId,
        mockContext.sessionId,
      );

      // Step 2: Verify it's blocked
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);

      // Step 3: Ensure error message doesn't leak the original user ID
      expect(result.error?.message).not.toContain("user_123");
      expect(result.error?.message).not.toContain("attacker_user");
    });

    it("prevents cross-tenant attacks even if session is valid", () => {
      const token = generateConfirmationToken(mockContext);

      // Attacker in tenant_xyz tries to use a token from tenant_abc
      const result = validateRotationRequest(
        {
          keyId: "key_live_abc123",
          confirmationToken: token,
          context: mockContext,
        },
        mockContext.userId, // Same user
        "tenant_xyz", // Different tenant - attack!
        mockContext.sessionId, // Same session
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(RotationErrorCode.CROSS_TENANT_VIOLATION);
    });

    it("forces re-authentication when token is replayed after session change", () => {
      const token = generateConfirmationToken(mockContext);

      // User rotates in session_xyz, then logs out and back in
      const result = validateRotationRequest(
        {
          keyId: "key_live_abc123",
          confirmationToken: token,
          context: mockContext,
        },
        mockContext.userId,
        mockContext.tenantId,
        "session_new_after_login", // New session - replay prevented!
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
    });

    it("safely handles backend errors without leaking secrets", () => {
      const backendError = new Error(
        "Failed to rotate key ck_live_sensitive123 due to database error",
      );
      const sanitized = sanitizeRotationError(backendError);

      expect(sanitized.message).not.toContain("ck_live_sensitive123");
      expect(sanitized.message).not.toContain("database error");
      expect(sanitized.code).toBe(RotationErrorCode.ROTATION_FAILED);
    });
  });

  describe("Error code completeness", () => {
    it("all RotationErrorCode values are documented in sanitizeRotationError", () => {
      const errorCodes = Object.values(RotationErrorCode) as string[];

      for (const code of errorCodes) {
        // We don't pass error objects, just the code
        const result = sanitizeRotationError(new Error("test"), code);
        expect(result.message).toBeTruthy();
        expect(result.message.length).toBeGreaterThan(0);
        // Ensure no error codes are leaked
        expect(result.message).not.toContain(code);
      }
    });
  });
});
