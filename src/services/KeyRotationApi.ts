/**
 * KeyRotationApi
 *
 * Backend integration for API key rotation with confirmation tokens.
 * This layer handles the HTTP communication with the backend while maintaining
 * the security boundaries established by KeyRotationService.
 *
 * Token flow (prevents replay and cross-tenant attacks):
 * 1. User clicks "Rotate Key"
 * 2. Frontend generates a confirmation token based on user context
 * 3. Frontend calls /api/rotate-key with the token
 * 4. Backend validates token matches user context
 * 5. Backend verifies token hasn't expired or been replayed
 * 6. Backend rotates key and returns new key (or error)
 * 7. Frontend displays new key or reverts on error
 *
 * Part of issue #991: Make API-key rotation confirmation lossless
 */

import { RotationRequest } from './KeyRotationService';
import { redactSensitiveData, classifyHttpError, logError } from './SecureErrorHandler';

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
 * This endpoint is protected by:
 * - Bearer token authentication (session token in Authorization header)
 * - Confirmation token in request body (prevents replay/cross-tenant)
 * - Server-side validation of user context (userId, tenantId, sessionId)
 *
 * The endpoint MUST:
 * 1. Verify the session bearer token is valid for the user
 * 2. Verify the confirmation token matches the user's context
 * 3. Check the token hasn't expired (15 minute window)
 * 4. Verify the keyId belongs to the user
 * 5. Perform the rotation and return the new key
 * 6. Log the rotation (without exposing keys) for audit trail
 *
 * Error responses MUST NOT leak:
 * - Old or new API keys
 * - Confirmation tokens
 * - User IDs, tenant IDs, or session IDs
 * - Implementation details or SQL errors
 */
const ROTATE_KEY_ENDPOINT = '/api/v1/keys/rotate';

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
  try {
    const response = await fetch(ROTATE_KEY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        keyId: rotationRequest.keyId,
        confirmationToken: rotationRequest.confirmationToken,
        context: rotationRequest.context,
      }),
      // Prevent hanging requests
      signal: AbortSignal.timeout(30000),
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorClassification = classifyHttpError(response.status);
      const data = await response.json().catch(() => ({}));

      // Log the error securely for debugging
      logError('KeyRotationApi.rotateKeyWithToken', data, {
        status: response.status,
        endpoint: ROTATE_KEY_ENDPOINT,
      });

      // Check for specific error codes from backend
      if (data?.error?.code) {
        return {
          success: false,
          error: {
            code: data.error.code,
            message: data.error.message || 'Failed to rotate API key.',
          },
        };
      }

      // Generic HTTP error response
      return {
        success: false,
        error: {
          code: errorClassification.retryable ? 'ROTATION_FAILED' : 'AUTHORIZATION_FAILED',
          message: 'Failed to rotate API key. Please try again.',
        },
      };
    }

    // Parse successful response
    const data = await response.json();

    if (data?.newKey) {
      return {
        success: true,
        newKey: data.newKey,
      };
    }

    // Unexpected response format
    logError('KeyRotationApi.rotateKeyWithToken', 'Invalid response format from server');

    return {
      success: false,
      error: {
        code: 'ROTATION_FAILED',
        message: 'Failed to rotate API key. Invalid server response.',
      },
    };
  } catch (error) {
    // Network errors, timeouts, or JSON parse errors
    logError('KeyRotationApi.rotateKeyWithToken', error, {
      endpoint: ROTATE_KEY_ENDPOINT,
    });

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'ROTATION_FAILED',
            message: 'Request timed out. Please try again.',
          },
        };
      }

      // Generic network error
      return {
        success: false,
        error: {
          code: 'ROTATION_FAILED',
          message: 'Network error during rotation. Please try again.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'ROTATION_FAILED',
        message: 'Failed to rotate API key. Please try again.',
      },
    };
  }
}

/**
 * Initiates a key rotation by requesting a confirmation token from the backend.
 * This token is then used in the actual rotation request.
 *
 * This two-step process ensures:
 * 1. The token is generated server-side with proper randomness
 * 2. The token is bound to a specific user/tenant/session context
 * 3. The token has server-side expiration tracking
 * 4. Replayed tokens can be detected and rejected
 *
 * Called before showing the rotation modal.
 */
export async function getRotationToken(
  keyId: string,
  sessionToken: string,
): Promise<{
  token?: string;
  expiresIn?: number; // milliseconds
  error?: {
    code: string;
    message: string;
  };
}> {
  try {
    const response = await fetch(`${ROTATE_KEY_ENDPOINT}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ keyId }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        error: {
          code: data?.error?.code || 'TOKEN_REQUEST_FAILED',
          message: data?.error?.message || 'Failed to request rotation token.',
        },
      };
    }

    const data = await response.json();
    return {
      token: data.token,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    return {
      error: {
        code: 'TOKEN_REQUEST_FAILED',
        message: 'Failed to request rotation token. Please try again.',
      },
    };
  }
}
