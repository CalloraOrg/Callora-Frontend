# Key Rotation Trust Model and Security Architecture

## 1. Executive Summary

API key rotation is a high-privilege administrative action. In CalloraOrg/Callora-Frontend, the key rotation feature (`KeyRotationModal`, `KeyRotationService`, and `KeyRotationApi`) implements a confirmation-token flow designed to prevent CSRF, replay attacks, cross-tenant violations, and unauthorized mutations.

This document outlines the intended server-issued trust model, explains idempotency key usage, classifies retry behaviors, and explicitly details what the frontend must never trust.

---

## 2. Server-Issued Token Trust Model (Intended Architecture)

### 2.1 The Problem with Client-Side Placeholders
In the current frontend implementation, `generateConfirmationToken` is a client-side placeholder:
```ts
export function generateConfirmationToken(context: RotationContext): string {
  const payload = {
    userId: context.userId,
    tenantId: context.tenantId,
    sessionId: context.sessionId,
    timestamp: context.timestamp,
    nonce: Math.random().toString(36).substring(2),
  };
  return btoa(JSON.stringify(payload));
}
```
> **SECURITY WARNING:** This client-side base64 encoding with `Math.random()` provides **zero cryptographic security**. It is purely a structural placeholder for testing and UI demonstration. Anyone with browser execution access can forge, decode, or manipulate this token.

### 2.2 Intended Server-Side Issuance Flow
In production deployment, confirmation tokens **must** be issued by the backend server:

1. **Initiation**: When the user opens the key rotation modal or clicks "Prepare Rotation", the frontend makes an authenticated request to `POST /api/keys/{keyId}/rotation-token`.
2. **Server Verification**: The backend verifies the user's session, RBAC permissions, and multi-factor authentication (MFA) status.
3. **Cryptographic Signing & Storage**:
   - The backend generates a cryptographically secure random token (e.g., using HMAC-SHA256 with a server-side secret or a secure Redis cache store).
   - The token is bound to specific attributes: `userId`, `tenantId`, `sessionId`, `keyId`, and an absolute expiration timestamp (e.g., 15 minutes TTL).
   - The token is recorded server-side as single-use (preventing replay).
4. **Issuance**: The backend returns the secure token to the client.
5. **Execution**: The client supplies this server-issued token in the subsequent `POST /api/keys/{keyId}/rotate` request.

---

## 3. What the Frontend Must Never Trust

To maintain robust security boundaries, the frontend architectural invariant is **Fail Closed**:

1. **Never Trust Client-Generated Tokens**: The frontend must treat any client-side token generation logic as non-secure and purely indicative of request structure. Production backends must reject any rotation request lacking a valid, server-issued cryptographic signature/token.
2. **Never Trust Optimistic UI State on Failure**: When an optimistic update displays a new provisional key (`ck_live_...`), it is purely local. If the backend mutation fails or returns an error, the frontend **must instantly revert** to the previous key and never persist or cache the failed key.
3. **Never Trust Client-Supplied Context Without Server Validation**: While the client sends context (`userId`, `tenantId`, `sessionId`, `timestamp`) for client-side validation and optimistic checks, the backend must independently re-validate every context attribute against the authenticated session claims.
4. **Never Expose Secrets in Error Messages**: Client-side error handlers (`SecureErrorHandler` and `sanitizeRotationError`) must strip API keys, bearer tokens, and internal stack traces before displaying messages to users or writing to console logs.

---

## 4. Idempotency Key Usage

Key rotation operations are non-idempotent by nature (generating a new secret invalidates the old one). However, network failures, timeouts, and client retries introduce ambiguity:

- **Idempotency Headers**: All mutation requests (`rotateKeyWithToken`) should include an `X-Idempotency-Key` (a unique UUIDv4 generated per user rotation attempt).
- **Backend Deduplication**: The backend must track idempotency keys within a short time window (e.g., 5 minutes). If a request with a duplicate idempotency key arrives:
  - If the original rotation succeeded, the backend should return the success response (without generating a second new key, or returning the cached result securely if permitted by policy).
  - If the original request failed or is still processing, the backend should handle it safely without creating duplicate concurrent key rotations.

---

## 5. Retry Classification

The frontend classifies rotation errors into retryable and non-retryable categories (`isRetryableError`):

| Error Code | Classification | Reason / Handling |
| :--- | :--- | :--- |
| `AUTHORIZATION_FAILED` | **Non-Retryable** | Permission issue. Retrying will not help. |
| `CROSS_TENANT_VIOLATION` | **Non-Retryable** | Security violation. Retrying will not help. |
| `TOKEN_EXPIRED` | **Non-Retryable** | Token TTL exceeded. User must initiate a new rotation flow to obtain a fresh token. |
| `TOKEN_INVALID` | **Non-Retryable** | Malformed or corrupted token. Retrying will not help. |
| `INVALID_INPUT` | **Non-Retryable** | Missing or invalid request parameters. |
| `KEY_NOT_FOUND` | **Non-Retryable** | Key was deleted or revoked. Requires page refresh. |
| `ROTATION_FAILED` (Network/Timeout) | **Retryable** | Transient network glitch, dropped connection, or gateway timeout. The user may safely retry using an idempotency key. |

---

## 6. Code References & TODOs

- **Service**: `src/services/KeyRotationService.ts` (`generateConfirmationToken` contains a TODO link to this document).
- **API**: `src/services/KeyRotationApi.ts`
- **UI Modal**: `src/pages/KeyRotationModal.tsx`
- **Tests**: `src/services/KeyRotationService.test.ts`
