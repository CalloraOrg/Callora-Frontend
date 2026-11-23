import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateConfirmationToken,
  isRetryableError,
  RotationErrorCode,
  sanitizeRotationError,
  stripSensitiveData,
  validateRotationRequest,
} from "./KeyRotationService";
import type { RotationContext, RotationRequest } from "./KeyRotationService";

// ---------------------------------------------------------------------------
// Constants mirrored from the module (not exported, so we redeclare them)
// ---------------------------------------------------------------------------

const TOKEN_VALIDITY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<RotationContext> = {}): RotationContext {
  return {
    userId: "user-abc",
    tenantId: "tenant-xyz",
    sessionId: "session-111",
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeRequest(
  context: RotationContext,
  overrides: Partial<RotationRequest> = {},
): RotationRequest {
  return {
    keyId: "key-001",
    confirmationToken: generateConfirmationToken(context),
    context,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateRotationRequest
// ---------------------------------------------------------------------------

describe("validateRotationRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("returns valid:true for a well-formed, fresh request", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx);

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // ── Missing keyId ───────────────────────────────────────────────────────

  it("rejects with INVALID_INPUT when keyId is missing", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx, { keyId: "" });

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
  });

  it("rejects with INVALID_INPUT when keyId is whitespace only", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx, { keyId: "   " });

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
  });

  // ── Missing token ───────────────────────────────────────────────────────

  it("rejects with TOKEN_INVALID when confirmationToken is missing", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx, { confirmationToken: "" });

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.TOKEN_INVALID);
  });

  // ── Missing context ─────────────────────────────────────────────────────

  it("rejects with INVALID_INPUT when context is missing", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx, { context: undefined as any });

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.INVALID_INPUT);
  });

  // ── Corrupt base64 ──────────────────────────────────────────────────────

  it("rejects with TOKEN_INVALID for a non-base64 confirmation token", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx, { confirmationToken: "!!!not-base64!!!" });

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.TOKEN_INVALID);
  });

  it("rejects with TOKEN_INVALID for valid base64 that is not JSON", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx, {
      confirmationToken: btoa("this-is-not-json"),
    });

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.TOKEN_INVALID);
  });

  // ── Expired token ───────────────────────────────────────────────────────

  it("rejects with TOKEN_EXPIRED when the token was issued more than 15 minutes ago", () => {
    // Issue the token at T=0
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx);

    // Advance time past the window
    vi.setSystemTime(
      new Date("2026-01-01T12:00:00Z").getTime() + TOKEN_VALIDITY_WINDOW_MS + 1,
    );

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.TOKEN_EXPIRED);
  });

  it("accepts a token at exactly the boundary (not yet expired)", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx);

    // Advance to exactly TOKEN_VALIDITY_WINDOW_MS (not over)
    vi.setSystemTime(
      new Date("2026-01-01T12:00:00Z").getTime() + TOKEN_VALIDITY_WINDOW_MS,
    );

    // The check is > window, so at exactly == window it should still be valid
    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(true);
  });

  // ── User mismatch ───────────────────────────────────────────────────────

  it("rejects with AUTHORIZATION_FAILED when userId does not match", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx);

    const result = validateRotationRequest(
      req,
      "different-user",
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
  });

  // ── Tenant mismatch ─────────────────────────────────────────────────────

  it("rejects with CROSS_TENANT_VIOLATION when tenantId does not match", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx);

    const result = validateRotationRequest(
      req,
      ctx.userId,
      "different-tenant",
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.CROSS_TENANT_VIOLATION);
  });

  // ── Session mismatch ────────────────────────────────────────────────────

  it("rejects with AUTHORIZATION_FAILED when sessionId does not match", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const ctx = makeContext();
    const req = makeRequest(ctx);

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      "different-session",
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.AUTHORIZATION_FAILED);
  });

  // ── Stale context.timestamp ─────────────────────────────────────────────

  it("rejects with TOKEN_EXPIRED when request.context.timestamp is stale", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));

    // A fresh token but a context that is already older than the window
    const staleTime =
      new Date("2026-01-01T12:00:00Z").getTime() -
      TOKEN_VALIDITY_WINDOW_MS -
      1;
    const ctx = makeContext({ timestamp: staleTime });
    const req = makeRequest(ctx);

    const result = validateRotationRequest(
      req,
      ctx.userId,
      ctx.tenantId,
      ctx.sessionId,
    );

    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe(RotationErrorCode.TOKEN_EXPIRED);
  });
});

// ---------------------------------------------------------------------------
// sanitizeRotationError
// ---------------------------------------------------------------------------

describe("sanitizeRotationError", () => {
  it("maps a network error to ROTATION_FAILED with a safe message", () => {
    const err = new Error("network error: DNS lookup failed");
    const result = sanitizeRotationError(err);

    expect(result.code).toBe(RotationErrorCode.ROTATION_FAILED);
    // The message must not leak the original technical detail
    expect(result.message.toLowerCase()).not.toContain("dns");
    expect(result.message.toLowerCase()).toContain("network");
  });

  it("maps a timeout error to ROTATION_FAILED with a safe message", () => {
    const err = new Error("timeout: request exceeded 30000ms");
    const result = sanitizeRotationError(err);

    expect(result.code).toBe(RotationErrorCode.ROTATION_FAILED);
    expect(result.message.toLowerCase()).toMatch(/timed?\s*out|timeout/);
  });

  it("uses a known error code from the backend when provided", () => {
    const result = sanitizeRotationError(
      new Error("some internal detail"),
      RotationErrorCode.TOKEN_EXPIRED,
    );

    expect(result.code).toBe(RotationErrorCode.TOKEN_EXPIRED);
    expect(result.message).not.toContain("some internal detail");
  });

  it("falls back to ROTATION_FAILED for an unknown error code", () => {
    const result = sanitizeRotationError(null, "COMPLETELY_UNKNOWN_CODE");

    expect(result.code).toBe(RotationErrorCode.ROTATION_FAILED);
  });

  it("never includes sensitive key material in the message", () => {
    const err = new Error("key: ck_live_abcdefghijklmnopqrstuv failed");
    const result = sanitizeRotationError(err);

    expect(result.message).not.toMatch(/ck_live_/);
  });
});

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe("isRetryableError", () => {
  it("returns false for AUTHORIZATION_FAILED", () => {
    expect(isRetryableError(RotationErrorCode.AUTHORIZATION_FAILED)).toBe(false);
  });

  it("returns false for CROSS_TENANT_VIOLATION", () => {
    expect(isRetryableError(RotationErrorCode.CROSS_TENANT_VIOLATION)).toBe(false);
  });

  it("returns false for TOKEN_EXPIRED", () => {
    expect(isRetryableError(RotationErrorCode.TOKEN_EXPIRED)).toBe(false);
  });

  it("returns false for TOKEN_INVALID", () => {
    expect(isRetryableError(RotationErrorCode.TOKEN_INVALID)).toBe(false);
  });

  it("returns false for INVALID_INPUT", () => {
    expect(isRetryableError(RotationErrorCode.INVALID_INPUT)).toBe(false);
  });

  it("returns false for KEY_NOT_FOUND", () => {
    expect(isRetryableError(RotationErrorCode.KEY_NOT_FOUND)).toBe(false);
  });

  it("returns true for ROTATION_FAILED (transient)", () => {
    expect(isRetryableError(RotationErrorCode.ROTATION_FAILED)).toBe(true);
  });

  it("returns true for an unrecognised code (treat unknown as transient)", () => {
    expect(isRetryableError("SOME_TRANSIENT_ERROR")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stripSensitiveData
// ---------------------------------------------------------------------------

describe("stripSensitiveData", () => {
  it("redacts ck_live_ key patterns", () => {
    const input = "Failed for key ck_live_abc12345678901234567890 at rotation.";
    const output = stripSensitiveData(input);

    expect(output).not.toContain("ck_live_abc12345678901234567890");
    expect(output).toContain("[REDACTED_KEY]");
  });

  it("redacts sk_ key patterns", () => {
    // Use a synthetic sk_ prefixed value (the redaction regex matches sk_<20+ alphanum>)
    const fakeKey = "sk_" + "a".repeat(24);
    const input = `${fakeKey} is invalid.`;
    const output = stripSensitiveData(input);

    expect(output).not.toContain(fakeKey);
    expect(output).toContain("[REDACTED_KEY]");
  });

  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig";
    const output = stripSensitiveData(input);

    expect(output).not.toContain("eyJhbGciOiJSUzI1NiJ9");
    expect(output).toContain("Bearer [REDACTED_TOKEN]");
  });

  it("does not modify a plain string with no secrets", () => {
    const input = "Rotation succeeded for key-id 42.";
    expect(stripSensitiveData(input)).toBe(input);
  });

  it("returns [non-string] for non-string input", () => {
    expect(stripSensitiveData(null as any)).toBe("[non-string]");
    expect(stripSensitiveData(42 as any)).toBe("[non-string]");
  });

  it("handles an empty string", () => {
    expect(stripSensitiveData("")).toBe("");
  });
});
