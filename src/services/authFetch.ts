/**
 * authFetch — authenticated fetch helper for Callora.
 *
 * Wraps `fetch` with:
 *   1. Path prefixing via `apiUrl()`.
 *   2. `Authorization: Bearer <token>` injection.
 *   3. On a 401, a single automatic token refresh followed by one retry.
 *   4. Single-flight refresh: concurrent 401s share one refresh promise so the
 *      backend is never asked to rotate the same token twice simultaneously.
 *   5. Abort-signal propagation: the caller's AbortSignal cancels both the
 *      initial request and any retry.
 *   6. Session-expired notification via `signalExpiry` when the refresh itself
 *      fails, so `SessionExpiryBanner` can surface the problem to the user.
 */

import { apiUrl } from "../config/constants";
import {
  getAccessToken,
  refreshAccessToken,
  signOut,
} from "./authService";
import { signalExpiry } from "./sessionExpiry";

// ─── Single-flight refresh ────────────────────────────────────────────────────

/**
 * Shared promise for an in-flight refresh.  Concurrent 401s wait on this
 * instead of each launching a separate POST /api/auth/refresh.  It is cleared
 * once the refresh resolves or rejects so the next refresh starts fresh.
 */
let _refreshPromise: Promise<string> | null = null;

/**
 * Return the in-flight refresh promise if one exists, otherwise start a new
 * one.  The promise resolves with the new access token.
 *
 * If the refresh fails, local auth state is cleared and a session-expired
 * event is emitted before the promise rejects.
 */
function ensureRefresh(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = refreshAccessToken()
    .catch(async (err: unknown) => {
      // Refresh failed — sign out locally and notify the banner.
      await signOut().catch(() => {
        // best-effort
      });
      signalExpiry("expired");
      // Re-throw so every waiting caller gets the rejection.
      throw err;
    })
    .finally(() => {
      // Clear the in-flight promise so the next 401 triggers a fresh refresh.
      _refreshPromise = null;
    });

  return _refreshPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the Callora API.
 *
 * @param path - API path relative to the configured API base (e.g. `/api/usage`).
 * @param init - Standard `RequestInit`; an `AbortSignal` here is forwarded to
 *               both the initial request and any retry.
 *
 * @returns The `Response` from the final attempt.  The caller is responsible
 *          for checking `response.ok`.
 *
 * @throws  Re-throws network errors and `AbortError`s.  Does **not** throw on
 *          HTTP errors (4xx / 5xx); check `response.ok` instead.
 */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = apiUrl(path);
  const token = getAccessToken();

  const headersWithAuth = buildHeaders(init.headers, token);

  // ── First attempt ─────────────────────────────────────────────────────────
  const firstResponse = await fetch(url, {
    ...init,
    headers: headersWithAuth,
  });

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  // ── 401: try to refresh ───────────────────────────────────────────────────
  // Check the abort signal before we even attempt the refresh.
  if (init.signal?.aborted) {
    throw createAbortError();
  }

  let newToken: string;
  try {
    newToken = await ensureRefresh();
  } catch {
    // Refresh failed — session-expiry was already signalled inside ensureRefresh.
    // Return the original 401 response so the caller can decide what to do.
    return firstResponse;
  }

  // Abort before retry?
  if (init.signal?.aborted) {
    throw createAbortError();
  }

  // ── Retry with new token ──────────────────────────────────────────────────
  const retryResponse = await fetch(url, {
    ...init,
    headers: buildHeaders(init.headers, newToken),
  });

  if (retryResponse.status === 401) {
    // Retry still failed — clear session and signal expiry.
    await signOut().catch(() => {});
    signalExpiry("expired");
  }

  return retryResponse;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildHeaders(
  base: HeadersInit | undefined,
  token: string | null,
): HeadersInit {
  const headers: Record<string, string> = {};

  // Spread any caller-supplied headers first.
  if (base) {
    if (base instanceof Headers) {
      base.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(base)) {
      for (const [key, value] of base) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, base);
    }
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

function createAbortError(): DOMException {
  // DOMException with "AbortError" is what native fetch throws when aborted.
  return new DOMException("The operation was aborted.", "AbortError");
}

/** @internal Expose for testing only. */
export function _getRefreshPromiseForTests(): Promise<string> | null {
  return _refreshPromise;
}

/** @internal Reset the in-flight refresh promise between tests. */
export function _resetRefreshPromiseForTests(): void {
  _refreshPromise = null;
}
