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
  logError,
  getSafeErrorMessage,
} from "./SecureErrorHandler";
import { apiClient, isApiError } from "../api/apiClient";
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
  let data: { newKey?: string; rotatedAt?: string };
  try {
    data = await apiClient.post<{ newKey?: string; rotatedAt?: string }>(
      ROTATE_KEY_ENDPOINT,
      {
        auth: false,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: {
          keyId: rotationRequest.keyId,
          confirmationToken: rotationRequest.confirmationToken,
          context: rotationRequest.context,
        },
        signal,
      },
    );
  } catch (err) {
    if (isApiError(err) && err.status > 0) {
      logError("KeyRotationApi.rotateKeyWithToken", err.data ?? {}, {
        status: err.status,
        endpoint: ROTATE_KEY_ENDPOINT,
      });

      const code =
        err.code && err.code !== "CLIENT_ERROR" && err.code !== "SERVER_ERROR" && err.code !== "CONFLICT"
          ? err.code
          : err.retryable
            ? "ROTATION_FAILED"
            : "AUTHORIZATION_FAILED";

      const nestedMsg =
        typeof err.data === "object" &&
        err.data !== null &&
        typeof (err.data as { error?: { message?: unknown } }).error?.message === "string"
          ? (err.data as { error: { message: string } }).error.message
          : "Failed to rotate API key.";

      throw new RotationApiError(redactSensitiveData(nestedMsg), {
        code,
        status: err.status,
        retryable: err.retryable,
      });
    }
    throw err;
  }

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
    const data = await apiClient.post<{ token?: string; expiresIn?: number }>(
      `${ROTATE_KEY_ENDPOINT}/token`,
      {
        auth: false,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: { keyId },
        timeoutMs: 10000,
      },
    );

    return {
      token: data.token,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    if (isApiError(error) && error.status > 0) {
      const data =
        typeof error.data === "object" && error.data !== null
          ? (error.data as { error?: { code?: string; message?: string } })
          : undefined;
      let code = data?.error?.code;
      if (!code) {
        if (error.status === 401) code = "UNAUTHORIZED";
        else if (error.status === 403) code = "FORBIDDEN";
        else if (error.status === 429) code = "TOO_MANY_REQUESTS";
        else code = "TOKEN_REQUEST_FAILED";
      }

      const rawMessage =
        data?.error?.message ||
        (error.status === 401
          ? "Unauthorized"
          : error.status === 403
            ? "Forbidden"
            : error.status === 429
              ? "Too many requests"
              : "Failed to request rotation token.");

      return {
        error: {
          code,
          message: redactSensitiveData(getSafeErrorMessage(rawMessage, code)),
        },
      };
    }

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
