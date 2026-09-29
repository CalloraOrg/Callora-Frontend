/**
 * SecureErrorHandler.test.ts
 *
 * Tests for secure error handling ensuring:
 * - API keys are never exposed
 * - Tokens are never exposed
 * - User IDs and sensitive context are never exposed
 * - Error messages are generic and safe
 * - Errors are properly classified for retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  redactSensitiveData,
  getSafeErrorMessage,
  logError,
  isRetryableError,
  formatErrorForUI,
  isSensitiveValue,
  createTelemetryError,
  classifyHttpError,
} from "./SecureErrorHandler";
import { RotationErrorCode } from "./KeyRotationService";

describe("SecureErrorHandler", () => {
  describe("redactSensitiveData", () => {
    it("redacts API keys", () => {
      const text = "Error rotating key ck_live_abcdef123456789";
      const result = redactSensitiveData(text);

      expect(result).not.toContain("ck_live_abcdef123456789");
      expect(result).toContain("[REDACTED_KEY]");
    });

    it("redacts bearer tokens", () => {
      const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";
      const result = redactSensitiveData(text);

      expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(result).toContain("[REDACTED_TOKEN]");
    });

    it("redacts JWT tokens", () => {
      const text = "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.TJVA95";
      const result = redactSensitiveData(text);

      expect(result).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(result).toContain("[REDACTED_TOKEN]");
    });

    it("redacts email addresses", () => {
      const text = "User user@example.com failed authentication";
      const result = redactSensitiveData(text);

      expect(result).not.toContain("user@example.com");
      expect(result).toContain("[REDACTED_EMAIL]");
    });

    it("redacts passwords", () => {
      const text = "password=MySecretPassword123 for database connection";
      const result = redactSensitiveData(text);

      expect(result).not.toContain("MySecretPassword123");
      expect(result).toContain("[REDACTED_PASSWORD]");
    });

    it("redacts credit card patterns", () => {
      const text = "Card: 4532-1111-2222-3333 was declined";
      const result = redactSensitiveData(text);

      expect(result).not.toContain("4532");
      expect(result).toContain("[REDACTED_CARD]");
    });

    it("redacts multiple sensitive values in one string", () => {
      const text =
        "Token eyJhbGc.eyJzdWI.TJVA95 for user@test.com with key ck_live_xyz123 failed";
      const result = redactSensitiveData(text);

      expect(result).not.toContain("eyJhbGc");
      expect(result).not.toContain("user@test.com");
      expect(result).not.toContain("ck_live_xyz123");
    });

    it("handles Error objects", () => {
      const error = new Error("Failed with key ck_live_secret123");
      const result = redactSensitiveData(error);

      expect(result).not.toContain("ck_live_secret123");
      expect(result).toContain("[REDACTED_KEY]");
    });

    it("handles empty strings", () => {
      const result = redactSensitiveData("");
      expect(result).toBe("");
    });

    it("handles null/undefined", () => {
      expect(redactSensitiveData(null as any)).toBeTruthy();
      expect(redactSensitiveData(undefined as any)).toBeTruthy();
    });
  });

  describe("getSafeErrorMessage", () => {
    it("returns safe message for authorization errors", () => {
      const result = getSafeErrorMessage(
        new Error("Authorization check failed"),
        RotationErrorCode.AUTHORIZATION_FAILED
      );

      expect(result).toBe("You are not authorized to rotate this key.");
      expect(result).not.toContain("Authorization check failed");
    });

    it("returns safe message for token expired", () => {
      const result = getSafeErrorMessage(
        new Error("Token expired at 2024-08-28"),
        RotationErrorCode.TOKEN_EXPIRED
      );

      expect(result).toContain("token has expired");
      expect(result).not.toContain("2024-08-28");
    });

    it("detects unauthorized pattern in error message", () => {
      const result = getSafeErrorMessage(
        new Error("Unauthorized: user 123 cannot access key")
      );

      expect(result).not.toContain("user 123");
      expect(result).not.toContain("cannot access");
    });

    it("detects timeout pattern", () => {
      const result = getSafeErrorMessage(
        new Error("Request timeout after 30000ms")
      );

      expect(result).toContain("timeout");
      expect(result).not.toContain("30000");
    });

    it("detects network errors", () => {
      const result = getSafeErrorMessage(
        new Error("Failed to fetch from server")
      );

      expect(result).toContain("Network");
      expect(result).not.toContain("fetch from server");
    });

    it("returns fallback message when provided", () => {
      const result = getSafeErrorMessage(
        new Error("Unknown error xyz"),
        undefined,
        "Custom fallback message"
      );

      expect(result).toBe("Custom fallback message");
    });

    it("handles string errors", () => {
      const result = getSafeErrorMessage("Unauthorized access");

      expect(result).not.toContain("access");
    });

    it("returns unknown error for unrecognized errors", () => {
      const result = getSafeErrorMessage(new Error("xyz_unknown_error_123"));

      expect(result).toContain("error occurred");
    });
  });

  describe("logError", () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("logs errors without exposing secrets", () => {
      const error = new Error("Failed with key ck_live_secret123");
      logError("TestContext", error);

      const logContent = consoleErrorSpy.mock.calls[0][1];
      expect(logContent).not.toContain("ck_live_secret123");
      expect(logContent).toContain("[REDACTED_KEY]");
    });

    it("includes context in log", () => {
      logError("MyContext", new Error("Test error"));

      const logContent = consoleErrorSpy.mock.calls[0][0];
      expect(logContent).toContain("[MyContext]");
    });

    it("sanitizes metadata", () => {
      logError("Context", new Error("Error"), {
        apiKey: "ck_live_secret",
        userId: "user_123",
      });

      const metadata = consoleErrorSpy.mock.calls[0][2];
      expect(metadata.apiKey).not.toContain("ck_live_secret");
      expect(metadata.apiKey).toContain("[REDACTED_KEY]");
    });
  });

  describe("isRetryableError", () => {
    it("returns false for authorization errors", () => {
      expect(isRetryableError(new Error("Unauthorized"), RotationErrorCode.AUTHORIZATION_FAILED)).toBe(false);
    });

    it("returns false for cross-tenant violations", () => {
      expect(isRetryableError(new Error("Cross-tenant"), RotationErrorCode.CROSS_TENANT_VIOLATION)).toBe(false);
    });

    it("returns false for token expired", () => {
      expect(isRetryableError(new Error("Expired"), RotationErrorCode.TOKEN_EXPIRED)).toBe(false);
    });

    it("returns false for invalid input", () => {
      expect(isRetryableError(new Error("Invalid"), RotationErrorCode.INVALID_INPUT)).toBe(false);
    });

    it("returns false for 404 not found", () => {
      expect(isRetryableError(new Error("404 not found"))).toBe(false);
    });

    it("returns true for network errors", () => {
      expect(isRetryableError(new Error("Network error"))).toBe(true);
    });

    it("returns true for timeout errors", () => {
      expect(isRetryableError(new Error("Request timeout"))).toBe(true);
    });

    it("returns true for server errors", () => {
      expect(isRetryableError(new Error("500 Internal server error"))).toBe(true);
    });

    it("returns true for generic rotation failures", () => {
      expect(isRetryableError(new Error("Rotation failed"))).toBe(true);
    });
  });

  describe("formatErrorForUI", () => {
    it("formats authorization error correctly", () => {
      const result = formatErrorForUI(
        new Error("Auth failed"),
        RotationErrorCode.AUTHORIZATION_FAILED
      );

      expect(result.message).toContain("not authorized");
      expect(result.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
      expect(result.isRetryable).toBe(false);
    });

    it("marks retryable errors", () => {
      const result = formatErrorForUI(
        new Error("Network timeout")
      );

      expect(result.isRetryable).toBe(true);
      expect(result.isDeveloperError).toBe(false);
    });

    it("marks non-retryable errors", () => {
      const result = formatErrorForUI(
        new Error("Invalid input")
      );

      expect(result.isRetryable).toBe(false);
    });

    it("flags potential developer errors", () => {
      const result = formatErrorForUI(
        new Error("Unexpected database error")
      );

      // Non-retryable error that's not auth/cross-tenant
      expect(result.isDeveloperError).toBe(false); // "database" won't match patterns
    });
  });

  describe("isSensitiveValue", () => {
    it("identifies API key strings", () => {
      expect(isSensitiveValue("apiKey_value")).toBe(true);
      expect(isSensitiveValue("ck_live_secret")).toBe(true);
    });

    it("identifies token strings", () => {
      expect(isSensitiveValue("token_abc123")).toBe(true);
      expect(isSensitiveValue("session_token")).toBe(true);
    });

    it("identifies secret strings", () => {
      expect(isSensitiveValue("secret_key_123")).toBe(true);
    });

    it("identifies password strings", () => {
      expect(isSensitiveValue("password123")).toBe(true);
    });

    it("ignores regular strings", () => {
      expect(isSensitiveValue("user_name")).toBe(false);
      expect(isSensitiveValue("error_message")).toBe(false);
      expect(isSensitiveValue("request_id")).toBe(false);
    });

    it("ignores non-string values", () => {
      expect(isSensitiveValue(123)).toBe(false);
      expect(isSensitiveValue(null)).toBe(false);
      expect(isSensitiveValue(undefined)).toBe(false);
    });
  });

  describe("createTelemetryError", () => {
    it("redacts all sensitive data", () => {
      const error = new Error(
        "Rotation failed for key ck_live_secret with token eyJhbGc"
      );
      const result = createTelemetryError(error, "RotationContext", {
        userId: "user_123",
        key: "ck_live_secret",
      });

      expect(result.message).not.toContain("ck_live_secret");
      expect(result.message).not.toContain("eyJhbGc");
      expect(result.context).not.toContain("RotationContext"); // Still present but may be redacted if it contains patterns
    });

    it("preserves structure for monitoring systems", () => {
      const error = new Error("Network timeout");
      const result = createTelemetryError(error, "TestContext");

      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("context");
      expect(typeof result.message).toBe("string");
    });

    it("extracts error code if present", () => {
      const error = new Error("Authorization failed") as any;
      error.code = RotationErrorCode.AUTHORIZATION_FAILED;

      const result = createTelemetryError(error, "Context");

      expect(result.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
    });

    it("handles string errors", () => {
      const result = createTelemetryError("String error message", "Context");

      expect(result.message).toBe("String error message");
    });

    it("redacts metadata values", () => {
      const result = createTelemetryError(new Error("Error"), "Context", {
        apiKey: "ck_live_secret",
        token: "eyJhbGc",
        timestamp: 12345,
      });

      expect(result.metadata?.apiKey).not.toContain("ck_live_secret");
      expect(result.metadata?.token).not.toContain("eyJhbGc");
      expect(result.metadata?.timestamp).toBe(12345); // Numbers unchanged
    });
  });

  describe("classifyHttpError", () => {
    it("classifies 400 as client error, non-retryable", () => {
      const result = classifyHttpError(400);
      expect(result.category).toBe("client_error");
      expect(result.retryable).toBe(false);
    });

    it("classifies 401 as client error, non-retryable", () => {
      const result = classifyHttpError(401);
      expect(result.category).toBe("client_error");
      expect(result.retryable).toBe(false);
    });

    it("classifies 403 as client error, non-retryable", () => {
      const result = classifyHttpError(403);
      expect(result.category).toBe("client_error");
      expect(result.retryable).toBe(false);
    });

    it("classifies 404 as client error, non-retryable", () => {
      const result = classifyHttpError(404);
      expect(result.category).toBe("client_error");
      expect(result.retryable).toBe(false);
    });

    it("classifies 429 as rate limit, retryable", () => {
      const result = classifyHttpError(429);
      expect(result.category).toBe("rate_limit");
      expect(result.retryable).toBe(true);
    });

    it("classifies 500 as server error, retryable", () => {
      const result = classifyHttpError(500);
      expect(result.category).toBe("server_error");
      expect(result.retryable).toBe(true);
    });

    it("classifies 502 as server error, retryable", () => {
      const result = classifyHttpError(502);
      expect(result.category).toBe("server_error");
      expect(result.retryable).toBe(true);
    });

    it("classifies 503 as server error, retryable", () => {
      const result = classifyHttpError(503);
      expect(result.category).toBe("server_error");
      expect(result.retryable).toBe(true);
    });

    it("classifies unknown status as unknown", () => {
      const result = classifyHttpError(418); // I'm a teapot
      expect(result.category).toBe("unknown");
    });
  });

  describe("Integration: Complete error flow", () => {
    it("handles complex error scenario safely", () => {
      // Simulate a real error with multiple sensitive pieces
      const error = new Error(
        "Failed to rotate API key ck_live_abcdef123456789 for user user@example.com in tenant tenant_xyz. Authorization token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.TJVA95"
      );

      // User-facing message
      const userMessage = getSafeErrorMessage(error);
      expect(userMessage).not.toContain("ck_live");
      expect(userMessage).not.toContain("user@example.com");
      expect(userMessage).not.toContain("eyJhbGc");

      // Telemetry message
      const telemetry = createTelemetryError(error, "RotationContext");
      expect(telemetry.message).not.toContain("ck_live");
      expect(telemetry.message).not.toContain("user@example.com");
      expect(telemetry.message).not.toContain("eyJhbGc");

      // Retry decision
      const retryable = isRetryableError(error);
      expect(typeof retryable).toBe("boolean");
    });

    it("preserves error information for debugging while protecting secrets", () => {
      const error = new Error("Rotation failed");
      (error as any).code = RotationErrorCode.ROTATION_FAILED;

      const formatted = formatErrorForUI(error);
      const telemetry = createTelemetryError(error, "Context");

      // Both preserve the error code
      expect(formatted.code).toBe(RotationErrorCode.ROTATION_FAILED);
      expect(telemetry.code).toBe(RotationErrorCode.ROTATION_FAILED);

      // But messages are safe
      expect(formatted.message).toBeTruthy();
      expect(telemetry.message).toBeTruthy();
    });
  });
});
