# API Key Rotation — Trust Model & Confirmation Token Contract

Status: **Normative reference for the key-rotation flow.**
Applies to:

- `src/services/KeyRotationService.ts` — validation primitives + **placeholder token generator**
- `src/services/KeyRotationApi.ts` — backend transport, idempotency, retries
- `src/pages/KeyRotationModal.tsx` — orchestration and UI state

This document exists because the frontend currently ships a
**non-secure placeholder** confirmation-token generator
(`generateConfirmationToken`). Without a written trust model, the
placeholder could be mistaken for a real CSRF-style defense. It is not.

---

## 1. The intended (server-issued) token flow

The confirmation token is a **server-issued, single-use capability** that
authorizes exactly one key-rotation mutation. The intended flow is:

1. **User clicks “Rotate Key”.**
2. **Frontend requests a token** from the backend:
   `POST /api/rotate-key/token` with the session bearer token and the
   `keyId` (see `getRotationToken` in `KeyRotationApi.ts`).
3. **Backend performs authorization** (session validity, key ownership,
   tenant binding) and, only if it passes, **mints the token
   server-side**:
   - cryptographically secure random value (≥ 128 bits of entropy),
     *never* derived from user-controlled fields;
   - bound server-side to `(userId, tenantId, sessionId, keyId)`;
   - stored server-side with a short TTL (the 15-minute window enforced
     by `TOKEN_VALIDITY_WINDOW_MS` is the reference bound);
   - marked unconsumed.
4. **Backend returns the opaque token** to the client. The client treats
   it as an opaque string — it must not need to parse it, and nothing in
   the client may depend on its internal structure.
5. **Frontend submits the rotation**: `POST /api/rotate-key` with the
   bearer token, the confirmation token in the body, and an
   `Idempotency-Key` header (see §3).
6. **Backend consumes the token atomically** with the rotation:
   validate binding + expiry, atomically mark it consumed
   (compare-and-swap), rotate the key, return the new key.
7. **Token is single-use.** Any replay attempt — even within the TTL —
   fails because the consumed flag is checked and set in one atomic
   operation.

### Why the token must be server-issued

- A client-generated token proves nothing: anyone controlling the
  browser can mint arbitrary values, so “possession of the token”
  carries zero authorization weight.
- Server-side binding is what makes the token a defense against replay
  and cross-tenant use: the server can verify that the token it minted
  for *this* user/session/key is the one being redeemed.
- Client-side “validation” of the token (`validateRotationRequest`)
  remains useful only as **fast, friendly pre-flight feedback** (catching
  staleness or context mismatches before a network round trip). It is
  **never** a security control.

## 2. The current placeholder is NON-SECURE

`generateConfirmationToken` in `KeyRotationService.ts` builds
`base64(JSON{userId, tenantId, sessionId, timestamp, nonce: Math.random()})`.

This is explicitly a **placeholder that MUST NOT be trusted**:

| Weakness | Consequence |
| --- | --- |
| `Math.random()` nonce | Not cryptographically secure; predictable and guessable. |
| Fully client-constructed | Anyone with devtools can forge any token; it proves nothing to the backend. |
| Plain base64, no signature | Trivially decodable, modifiable, and re-encodable. |
| No server-side state | Nothing tracks issuance or consumption, so replay protection is impossible. |
| Encode-only “obfuscation” | Base64 is not encryption and provides no integrity. |

`KeyRotationModal.tsx` also calls the placeholder directly
(`generateConfirmationToken(context)` in `handleRotate`). Until the
backend issues real tokens, this flow is a **demo skeleton**: the
frontend-side `validateRotationRequest` check gives UX-level feedback
only, and the backend integration is expected to reject or ignore the
placeholder token.

**Rule:** the placeholder must be replaced by the
`getRotationToken()` → `rotateKeyWithToken()` server-issued flow before
the rotation feature is enabled for real tenants.

## 3. Idempotency key usage

Every rotation request carries an `Idempotency-Key` header:

- Generated once per user-initiated rotation attempt via
  `generateIdempotencyKey("key-rotate")` in `rotateKeyWithToken`.
- The **same key is reused for every retry of that attempt** (timeouts,
  network errors). This is what lets the backend recognize a retry of
  the *same* logical operation rather than a new one.
- A **new user action must generate a new idempotency key.** Retrying
  after the user explicitly re-opened the dialog is a new operation.
- The backend should persist `(Idempotency-Key → response)` long enough
  to deduplicate retries (24 h is the reference retention) and return the
  cached response for replays instead of rotating twice.

Together, the single-use confirmation token (authorization, consumed
once) and the idempotency key (transport-level deduplication) give two
independent layers: the token prevents a *replayed authorization* from
rotating twice; the idempotency key prevents an *ambiguous network
outcome* from producing two rotations.

## 4. Retry classification

`isRetryableError` in `KeyRotationService.ts` classifies failure modes:

| Error code | Retry? | Reasoning / frontend behavior |
| --- | --- | --- |
| `AUTHORIZATION_FAILED` | ❌ | Permission will not change by retrying. Surface the safe message; no retry affordance. |
| `CROSS_TENANT_VIOLATION` | ❌ | Same as above; retrying is at best noise and at worst probing. |
| `KEY_NOT_FOUND` | ❌ | The key is gone; the UI should refresh the key list instead. |
| `TOKEN_INVALID` | ❌ | The token is malformed/unknown; a retry with the *same* token cannot succeed. Requires a new server-issued token (a “new rotation”, not a retry). |
| `TOKEN_EXPIRED` | ❌ | Same-token retry cannot succeed; restart the flow to obtain a fresh token. |
| `INVALID_INPUT` | ❌ | Deterministic client bug; fix the input, don’t hammer the API. |
| `ROTATION_FAILED` (generic) | ✅ | Umbrella for transient backend failures; safe to retry with the same token + idempotency key. |
| Network errors / timeouts | ✅ | `withRetry` retries with exponential backoff (`ROTATION_MAX_RETRIES`, `ROTATION_BASE_DELAY_MS`). The **same** idempotency key is reused so the backend can deduplicate. |

Additional invariants:

- `withRetry`’s `shouldRetry` is wired to `isRetryableRotationError`,
  which must stay consistent with the table above.
- Timeout classification comes from `isTimeoutError` (the
  `TimeoutError` produced by `runWithTimeout`), not from string matching.
- After exhausting retries, the modal shows the sanitized error
  (`sanitizeRotationError`) and offers a retry only when
  `isRetryableError` says the code is retryable.

## 5. What the frontend must NEVER trust

1. **Never trust a client-generated confirmation token** — including the
   placeholder’s output — as evidence of authorization. Only a
   server-issued, unconsumed, unexpired token authorizes a rotation.
2. **Never trust token contents.** The real token is opaque; any
   structure the placeholder happens to encode is incidental and must
   not become an API contract.
3. **Never display or persist the old key, the new key, or the
   confirmation token** beyond the strict minimum needed for the UX
   (see `SecureErrorHandler` / `stripSensitiveData`); never include them
   in logs, telemetry, or error reports.
4. **Never trust client-side validation as a security boundary.**
   `validateRotationRequest` is a pre-flight UX check; the backend must
   re-verify session, ownership, tenant binding, token expiry, and
   single-use consumption on every request.
5. **Never trust optimistic UI state.** `KeyRotationModal` reverts the
   displayed key on failure; the server’s response is the only source of
   truth for whether a rotation happened.
6. **Never reuse a confirmation token or idempotency key across
   distinct user-initiated rotations.**

## 6. References in code

- Placeholder + validation primitives: `src/services/KeyRotationService.ts`
- Transport, idempotency, retries: `src/services/KeyRotationApi.ts`
- Orchestration / UI state: `src/pages/KeyRotationModal.tsx`
- Tests: `src/services/KeyRotationService.test.ts`,
  `src/services/KeyRotationApi.test.ts`,
  `src/services/KeyRotation.adversarial.test.ts`
