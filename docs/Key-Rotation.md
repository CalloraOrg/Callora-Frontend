# API Key Rotation — Trust Model & Confirmation Token Contract

Status: **Shipped production specification for key rotation.**
Applies to:

- `src/services/KeyRotationService.ts` — validation primitives and context typing
- `src/services/KeyRotationApi.ts` — backend transport (`getRotationToken`, `rotateKeyWithToken`), idempotency, retries
- `src/pages/KeyRotationModal.tsx` — accessible orchestration and modal state
- `src/pages/MyApis.tsx` — integration with provider API list

---

## 1. The server-issued token flow

The confirmation token is a **server-issued, single-use capability** that
authorizes exactly one key-rotation mutation. The shipped production flow is:

1. **User triggers rotation:** On the My APIs page (`src/pages/MyApis.tsx`), each listed API row contains a "Rotate key" action (disabled with a tooltip when signed out). Clicking it opens `KeyRotationModal`.
2. **User confirms rotation:** Clicking "Rotate Key" in the modal initiates the rotation process.
3. **Frontend requests a confirmation token:**
   `POST /api/rotate-key/token` is invoked with the session bearer token (`Authorization: Bearer <sessionToken>`) and the `keyId` in the body via `getRotationToken(keyId, sessionToken)` in `src/services/KeyRotationApi.ts`.
4. **Backend performs authorization:** Validates session token, tenant context, and key ownership, then mints a cryptographically secure, opaque token with a 15-minute TTL.
5. **Frontend treats the token as opaque:** The token is never inspected, parsed, logged, or exposed in the DOM.
6. **Frontend submits rotation mutation:**
   `POST /api/rotate-key` is called via `rotateKeyWithToken` with the confirmation token, context, and an `Idempotency-Key` header.
7. **Backend consumes token atomically:** Verifies token binding and expiry, flags it consumed (single-use compare-and-swap), executes key rotation, and returns the newly generated API key.
8. **Frontend reveals new key & notifies user:** The new key is revealed once in the modal, a success toast is displayed, the row's "last rotated" display is refreshed, and the change is announced to assistive technology via a `LiveRegion`.
9. **Error recovery & retry:** If the token request or rotation fails, `SecureErrorHandler` translates the error to a safe, generic message. A retry button is provided for transient errors without falling back to any client-minted token.

---

## 2. Security guarantees & trust boundaries

| Aspect | Guarantee |
| --- | --- |
| **Token issuance** | Minted exclusively server-side with cryptographic entropy. Client never mints confirmation tokens in production. |
| **Token lifecycle** | Single-use with strict 15-minute TTL (`TOKEN_VALIDITY_WINDOW_MS`). Replay attempts are rejected. |
| **Context binding** | Tokens are strictly bound to `(userId, tenantId, sessionId, keyId)` on the server. Cross-tenant or session tampering fails closed. |
| **Data minimization** | Tokens and raw keys are never logged, sent to telemetry, or persisted in unencrypted client storage. |
| **Idempotency** | Every rotation attempt generates an `Idempotency-Key` to safely handle network retries and deduplication. |
| **Accessibility** | Focus is trapped inside `KeyRotationModal` on open, dismissible with Escape, and status changes are announced via `LiveRegion`. |

---

## 3. Idempotency key usage

Every rotation request carries an `Idempotency-Key` header:

- Generated once per user-initiated rotation attempt via
  `generateIdempotencyKey()` in `rotateKeyWithToken`.
- The **same key is reused for retries of that attempt** (timeouts,
  transient network errors). This allows the backend to detect duplicate
  transports and avoid redundant rotations.
- Explicit retry after failure generates a fresh idempotency key for the new attempt.

---

## 4. Error classification & retry policy

`isRetryableError` in `SecureErrorHandler.ts` and `KeyRotationService.ts` classifies errors:

| Error code / status | Retry? | UI behavior |
| --- | --- | --- |
| `UNAUTHORIZED` (401) | ❌ | Session expired or unauthenticated; surface safe message. |
| `FORBIDDEN` / `AUTHORIZATION_FAILED` (403) | ❌ | Permission denied; safe message shown, no retry affordance. |
| `CROSS_TENANT_VIOLATION` | ❌ | Context mismatch; safe message, retry suppressed. |
| `KEY_NOT_FOUND` (404) | ❌ | Target key does not exist; user prompted to refresh list. |
| `TOO_MANY_REQUESTS` (429) | ✅ | Rate limited; retry permitted with backoff. |
| `TIMEOUT` / `NETWORK_ERROR` | ✅ | Transient transport failure; retry affordance enabled. |
| `ROTATION_FAILED` (5xx) | ✅ | Generic server-side failure; safe to retry. |

---

## 5. References in code

- Transport, tokens, idempotency: `src/services/KeyRotationApi.ts`
- Security types and validation: `src/services/KeyRotationService.ts`
- Modal orchestration & focus trap: `src/pages/KeyRotationModal.tsx`
- Provider API row integration: `src/pages/MyApis.tsx`
- Automated test suites: `src/services/KeyRotationApi.test.ts`, `src/pages/KeyRotationModal.test.tsx`, `src/pages/MyApis.test.tsx`
