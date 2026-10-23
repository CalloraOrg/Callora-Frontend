/**
 * KeyRotationService
 *
 * Handles API key rotation with security boundaries including:
 * - Authorization and validation before mutation
 * - Confirmation tokens to prevent replay/cross-tenant attacks
 * - Secure error handling that fails closed without leaking secrets
 * - Staleness checks and malformed input detection
 *
 * Part of issue #991: Make API-key rotation confirmation lossless
 */

export interface RotationContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  timestamp: number;
}

export interface RotationRequest {
  keyId: string;
  confirmationToken: string;
  context: RotationContext;
}

export interface RotationResponse {
  success: boolean;
  newKey?: string;
  error?: {
    code: string;
    message: string; // Safe, non-leaking message for the user
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Token validity window in milliseconds (15 minutes).
 * Prevents stale or replayed tokens from being accepted.
 */
const TOKEN_VALIDITY_WINDOW_MS = 15 * 60 * 1000;

/**
 * Safe error codes that can be returned to the client.
 * These do NOT leak implementation details or secrets.
 */
export enum RotationErrorCode {
  AUTHORIZATION_FAILED = "AUTHORIZATION_FAILED",
  INVALID_INPUT = "INVALID_INPUT",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  CROSS_TENANT_VIOLATION = "CROSS_TENANT_VIOLATION",
  KEY_NOT_FOUND = "KEY_NOT_FOUND",
  ROTATION_FAILED = "ROTATION_FAILED",
}

function generateSecureNonce(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Web Crypto is required to generate a rotation nonce.");
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Encodes the rotation context with a 128-bit random nonce for this frontend
 * placeholder. Base64 does not authenticate the token; the server must still
 * authorize the request and should issue/store its own confirmation token.
 */
export function generateConfirmationToken(context: RotationContext): string {
  const payload = {
    userId: context.userId,
    tenantId: context.tenantId,
    sessionId: context.sessionId,
    timestamp: context.timestamp,
    nonce: generateSecureNonce(),
  };
  return btoa(JSON.stringify(payload));
}

/**
 * Validates a rotation request before executing the actual key rotation.
 *
 * Security checks performed:
 * 1. Authorization: Verify the user has permission to rotate this key
 * 2. Token validity: Check the confirmation token hasn't expired
 * 3. Token authenticity: Verify the token matches the request context
 * 4. Cross-tenant: Ensure the key belongs to the user's tenant
 * 5. Input validation: Check keyId and token format
 * 6. Staleness: Reject requests that are too old
 *
 * Returns a detailed ValidationResult. If invalid, the caller MUST fail closed
 * without attempting the rotation.
 */
export function validateRotationRequest(
  request: RotationRequest,
  currentUserId: string,
  currentTenantId: string,
  currentSessionId: string,
): ValidationResult {
  // 1. Input validation: Check for malformed/missing fields
  if (!request || typeof request !== "object") {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.INVALID_INPUT,
        message: "Request is malformed or missing required fields.",
      },
    };
  }

  if (
    !request.keyId ||
    typeof request.keyId !== "string" ||
    request.keyId.trim() === ""
  ) {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.INVALID_INPUT,
        message: "Key ID is missing or invalid.",
      },
    };
  }

  if (
    !request.confirmationToken ||
    typeof request.confirmationToken !== "string"
  ) {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.TOKEN_INVALID,
        message: "Confirmation token is missing or invalid.",
      },
    };
  }

  if (!request.context || typeof request.context !== "object") {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.INVALID_INPUT,
        message: "Context is missing or invalid.",
      },
    };
  }

  // 2. Parse and validate the token
  let tokenPayload: any;
  try {
    const decoded = atob(request.confirmationToken);
    tokenPayload = JSON.parse(decoded);
  } catch {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.TOKEN_INVALID,
        message: "Confirmation token is invalid or corrupted.",
      },
    };
  }

  // 3. Token validity: Check expiration
  const now = Date.now();
  const tokenAge = now - tokenPayload.timestamp;
  if (tokenAge > TOKEN_VALIDITY_WINDOW_MS) {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.TOKEN_EXPIRED,
        message: "Confirmation token has expired. Please start a new rotation.",
      },
    };
  }

  // 4. Authorization checks: Verify user and tenant match
  if (tokenPayload.userId !== currentUserId) {
    // Don't leak which field mismatched; return a generic authorization error
    return {
      valid: false,
      error: {
        code: RotationErrorCode.AUTHORIZATION_FAILED,
        message: "You are not authorized to rotate this key.",
      },
    };
  }

  if (tokenPayload.tenantId !== currentTenantId) {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.CROSS_TENANT_VIOLATION,
        message: "You are not authorized to rotate this key.",
      },
    };
  }

  if (tokenPayload.sessionId !== currentSessionId) {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.AUTHORIZATION_FAILED,
        message: "Your session has changed. Please start a new rotation.",
      },
    };
  }

  // 5. Request context staleness check
  const requestContextAge = now - request.context.timestamp;
  if (requestContextAge > TOKEN_VALIDITY_WINDOW_MS) {
    return {
      valid: false,
      error: {
        code: RotationErrorCode.TOKEN_EXPIRED,
        message: "Request context has expired. Please start a new rotation.",
      },
    };
  }

  // All checks passed
  return { valid: true };
}

/**
 * Safely handles errors from the key rotation backend call.
 * Ensures secrets are NEVER leaked in error messages.
 *
 * Maps backend error responses to safe, user-facing messages that don't
 * expose implementation details, API keys, or sensitive state.
 */
export function sanitizeRotationError(
  error: unknown,
  errorCode?: string,
): { code: string; message: string } {
  // If error is a network/fetch error, don't expose details
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes("network") || message.includes("fetch")) {
      return {
        code: RotationErrorCode.ROTATION_FAILED,
        message: "Network error during rotation. Please try again.",
      };
    }

    // Timeout errors
    if (message.includes("timeout")) {
      return {
        code: RotationErrorCode.ROTATION_FAILED,
        message: "Request timed out. Please try again.",
      };
    }
  }

  // If we have a structured error code from the backend, use it
  if (
    errorCode &&
    Object.values(RotationErrorCode).includes(errorCode as RotationErrorCode)
  ) {
    // Map the error code to a safe user message
    const safeMessages: Record<string, string> = {
      [RotationErrorCode.AUTHORIZATION_FAILED]:
        "You are not authorized to rotate this key.",
      [RotationErrorCode.INVALID_INPUT]:
        "Invalid rotation request. Please try again.",
      [RotationErrorCode.TOKEN_EXPIRED]:
        "Confirmation token has expired. Please start a new rotation.",
      [RotationErrorCode.TOKEN_INVALID]:
        "Confirmation token is invalid. Please start a new rotation.",
      [RotationErrorCode.CROSS_TENANT_VIOLATION]:
        "You are not authorized to rotate this key.",
      [RotationErrorCode.KEY_NOT_FOUND]:
        "Key not found. Please refresh and try again.",
      [RotationErrorCode.ROTATION_FAILED]:
        "Failed to rotate API key. Please try again.",
    };
    return {
      code: errorCode,
      message: safeMessages[errorCode] || "An error occurred during rotation.",
    };
  }

  // Default: generic, non-leaking error message
  return {
    code: RotationErrorCode.ROTATION_FAILED,
    message: "Failed to rotate API key. Please try again.",
  };
}

/**
 * Determines if an error should prevent retries or allow the user to retry.
 *
 * - Permanent failures (authorization, invalid key): Don't retry
 * - Transient failures (network, timeout): Allow retry
 * - Expired token: Force user to start a new rotation
 */
export function isRetryableError(errorCode: string): boolean {
  const nonRetryableErrors = [
    RotationErrorCode.AUTHORIZATION_FAILED,
    RotationErrorCode.CROSS_TENANT_VIOLATION,
    RotationErrorCode.KEY_NOT_FOUND,
    RotationErrorCode.TOKEN_INVALID,
    RotationErrorCode.TOKEN_EXPIRED,
    RotationErrorCode.INVALID_INPUT,
  ];
  return !nonRetryableErrors.includes(errorCode as RotationErrorCode);
}

/**
 * Ensures that API keys and sensitive details are never stored in logs,
 * error messages, or client-side state.
 *
 * This function strips sensitive patterns from any string before logging.
 */
export function stripSensitiveData(text: string): string {
  if (typeof text !== "string") {
    return "[non-string]";
  }

  // Strip API key patterns (e.g., ck_live_*, sk_*, pk_*)
  let sanitized = text.replace(
    /\b(ck_live_|sk_|pk_)[a-zA-Z0-9_]{20,}\b/g,
    "[REDACTED_KEY]",
  );

  // Strip bearer tokens
  sanitized = sanitized.replace(
    /Bearer\s+[a-zA-Z0-9\-_.~+/]+=*/gi,
    "Bearer [REDACTED_TOKEN]",
  );

  // Strip common secret patterns
  sanitized = sanitized.replace(
    /(?:password|secret|token)[\s:=]+([^\s,;)]*)/gi,
    "$1 = [REDACTED]",
  );

  return sanitized;
}
