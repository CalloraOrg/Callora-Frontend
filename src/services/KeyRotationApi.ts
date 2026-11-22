/**
 * KeyRotationApi
 *
 * Backend integration for API key rotation with confirmation tokens.
 * This layer handles HTTP communication with the backend while maintaining
 * the security boundaries established by KeyRotationService.
 *
 * Token flow (prevents replay and cross-tenant attacks):
 * 1. User clicks "Rotate Key" in My APIs or key management UI
 * 2. Frontend requests an opaque, single-use confirmation token from the server
 *    via POST /api/rotate-key/token (getRotationToken).
 * 3. Backend verifies session, key ownership, and mints an unconsumed token with a 15-minute TTL.
 * 4. Frontend calls POST /api/rotate-key (rotateKeyWithToken) with the server-minted
 *    token and an Idempotency-Key.
 * 5. Backend validates token binding and expiry, atomically consumes the token,
 *    and returns the newly rotated key.
 * 6. Frontend displays the new key once and announces success.
 *
 * See docs/Key-Rotation.md for the normative trust model.
 */

import { RotationRequest } from "./KeyRotationService";
import {
  redactSensitiveData,
  classifyHttpError,
  logError,
  getSafeErrorMessage,
} from "./SecureErrorHandler";
import {
  generateIdempotencyKey,
  createInFlightGuard,
  runWithTimeout,
  withRetry,
  isTimeoutError,
} from "./idempotency";

export interface KeyRotationApiResponse {
  success: boolean;
  newKey?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * API endpoint for rotating API keys with token-based authorization.
 * Protected by:
 * - Bearer token authentication (session token in Authorization header)
 * - Confirmation token in request body (prevents replay/cross-tenant)
 * - Server-side validation of user context (userId, tenantId, sessionId)
 */
const ROTATE_KEY_ENDPOINT = "/api/rotate-key";
const ROTATION_TIMEOUT_MS = 30_000;
const ROTATION_MAX_RETRIES = 1;
const ROTATION_BASE_DELAY_MS = 250;
class RotationApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { code: string; status?: number; retryable?: boolean },
  ) {
    super(message);
    this.name = "RotationApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

const rotationGuard = createInFlightGuard<KeyRotationApiResponse>();
function isRetryableRotationError(error: unknown): boolean {
  return error instanceof RotationApiError && error.retryable;
}

function toRotationFailure(error: unknown): KeyRotationApiResponse {
  const baseMessage = "Failed to rotate API key. Please try again.";

  if (error instanceof RotationApiError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: redactSensitiveData(error.message || baseMessage),
      },
    };
  }

  if (error instanceof Error) {
    const isAbort =
      error.name === "AbortError" ||
      (typeof error.message === "string" &&
        error.message.toLowerCase().includes("abort"));

    if (isTimeoutError(error) || isAbort) {
      return {
        success: false,
        error: {
          code: "ROTATION_FAILED",
          message:
            "The rotation request exceeded its timeout. Please try again.",
        },
      };
    }

    return {
      success: false,
      error: {
        code: "ROTATION_FAILED",
        message: redactSensitiveData(
          "Network error during rotation. Please try again.",
        ),
      },
    };
  }

  return {
    success: false,
    error: {
      code: "ROTATION_FAILED",
      message: baseMessage,
    },
  };
}

async function performRotation(
  rotationRequest: RotationRequest,
  sessionToken: string,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<KeyRotationApiResponse> {
  const response = await fetch(ROTATE_KEY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      keyId: rotationRequest.keyId,
      confirmationToken: rotationRequest.confirmationToken,
      context: rotationRequest.context,
    }),
    signal,
  });

  if (!response.ok) {
    const errorClassification = classifyHttpError(response.status);
    const data = await response.json().catch(() => ({}));

    logError("KeyRotationApi.rotateKeyWithToken", data, {
      status: response.status,
      endpoint: ROTATE_KEY_ENDPOINT,
    });

    const code = data?.error?.code
      ? String(data.error.code)
      : errorClassification.retryable
        ? "ROTATION_FAILED"
        : "AUTHORIZATION_FAILED";

    throw new RotationApiError(
      redactSensitiveData(data?.error?.message || "Failed to rotate API key."),
      {
        code,
        status: response.status,
        retryable: errorClassification.retryable,
      },
    );
  }

  const data = await response.json();

  if (data?.newKey) {
    return {
      success: true,
      newKey: data.newKey,
    };
  }

  logError(
    "KeyRotationApi.rotateKeyWithToken",
    "Invalid response format from server",
  );

  throw new RotationApiError(
    "Failed to rotate API key. Invalid server response.",
    {
      code: "ROTATION_FAILED",
      retryable: false,
    },
  );
}

/**
 * Rotates an API key using the backend with token-based confirmation.
 *
 * Security guarantees:
 * - Authorization is validated server-side before mutation
 * - Confirmation token prevents replayed requests
 * - Tokens expire after 15 minutes
 * - Cross-tenant attacks are blocked by context validation
 *
 * The request includes:
 * - keyId: The key to rotate
 * - confirmationToken: Cryptographically secure token tied to user context
 * - context: User/tenant/session info for validation
 *
 * Errors are sanitized by the service layer before display.
 */
export async function rotateKeyWithToken(
  rotationRequest: RotationRequest,
  sessionToken: string, // Bearer token from current session
): Promise<KeyRotationApiResponse> {
  const idempotencyKey = generateIdempotencyKey();

  try {
    return await rotationGuard.run(rotationRequest.keyId, () =>
      withRetry(
        () =>
          runWithTimeout(
            (signal) =>
              performRotation(
                rotationRequest,
                sessionToken,
                idempotencyKey,
                signal,
              ),
            ROTATION_TIMEOUT_MS,
          ),
        {
          maxRetries: ROTATION_MAX_RETRIES,
          baseDelayMs: ROTATION_BASE_DELAY_MS,
          shouldRetry: isRetryableRotationError,
        },
      ),
    );
  } catch (error) {
    logError("KeyRotationApi.rotateKeyWithToken", error, {
      endpoint: ROTATE_KEY_ENDPOINT,
    });

    return toRotationFailure(error);
  }
}

export async function getRotationToken(
  keyId: string,
  sessionToken: string,
): Promise<{
  token?: string;
  expiresIn?: number;
  error?: {
    code: string;
    message: string;
  };
}> {
  try {
    const response = await fetch(`${ROTATE_KEY_ENDPOINT}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ keyId }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      let code = data?.error?.code;
      if (!code) {
        if (response.status === 401) code = "UNAUTHORIZED";
        else if (response.status === 403) code = "FORBIDDEN";
        else if (response.status === 429) code = "TOO_MANY_REQUESTS";
        else code = "TOKEN_REQUEST_FAILED";
      }

      const rawMessage =
        data?.error?.message ||
        (response.status === 401
          ? "Unauthorized"
          : response.status === 403
            ? "Forbidden"
            : response.status === 429
              ? "Too many requests"
              : "Failed to request rotation token.");

      return {
        error: {
          code,
          message: redactSensitiveData(getSafeErrorMessage(rawMessage, code)),
        },
      };
    }

    const data = await response.json();
    return {
      token: data.token,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    const isTimeout =
      (error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")) ||
      isTimeoutError(error);
    const code = isTimeout ? "TIMEOUT" : "NETWORK_ERROR";
    const rawMessage = isTimeout
      ? "Request timed out."
      : "Network error. Please check your connection.";

    return {
      error: {
        code,
        message: redactSensitiveData(getSafeErrorMessage(rawMessage, code)),
      },
    };
  }
}
