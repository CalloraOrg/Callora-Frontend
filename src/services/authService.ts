/**
 * authService — wallet-based authentication for Callora.
 *
 * Signs in by requesting a Freighter signature over a challenge message that
 * binds the domain, wallet address, timestamp and a random nonce, then POSTs
 * the result to POST /api/auth/wallet.
 *
 * Token storage policy:
 *   - Access token:  module-level variable (in-memory only, never persisted).
 *   - Refresh token: sessionStorage, guarded with try/catch.
 *
 * See docs/Configuration.md § Session model for the trade-off rationale and
 * the httpOnly-cookie upgrade path.
 *
 * Never log tokens, signatures or messages. Use SecureErrorHandler for errors
 * that surface to the user.
 */

import { requestAccess, signMessage } from "@stellar/freighter-api";
import { apiUrl } from "../config/constants";

// ─── In-memory token store ────────────────────────────────────────────────────

/** Access token kept only in memory; never written to any persistent store. */
let _accessToken: string | null = null;

const REFRESH_TOKEN_KEY = "callora-refresh-token";

function loadRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveRefreshToken(token: string): void {
  try {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    // sessionStorage blocked (e.g. private browsing, storage full) — degrade
    // gracefully: the session works until the tab is closed or the page is
    // reloaded; the user will simply need to sign in again.
  }
}

function clearRefreshToken(): void {
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Nothing to do if it is already gone.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Return the current in-memory access token, or null when signed out. */
export function getAccessToken(): string | null {
  return _accessToken;
}

/** Return whether the user currently has an access token in memory. */
export function isSignedIn(): boolean {
  return _accessToken !== null;
}

export type SignInResult = {
  accessToken: string;
  walletAddress: string;
};

/**
 * Sign in with Freighter.
 *
 * 1. Request wallet access (prompts the user to connect if not already).
 * 2. Build a message that includes the app origin, wallet address, ISO
 *    timestamp and a random nonce so the signature cannot be replayed.
 * 3. Ask Freighter to sign the message.
 * 4. POST to POST /api/auth/wallet and store the returned tokens.
 *
 * Throws `AuthServiceError` on all failure paths except user rejection, which
 * throws with `code === "SIGNATURE_REJECTED"`.
 */
export async function signIn(): Promise<SignInResult> {
  // Step 1 – connect wallet.
  const access = await requestAccess();
  if (access.error) {
    throw new AuthServiceError("WALLET_UNAVAILABLE", "Freighter is not installed or available.");
  }
  if (!access.address) {
    throw new AuthServiceError(
      "WALLET_UNAVAILABLE",
      "Freighter did not return an address. Connect an account and try again.",
    );
  }
  const walletAddress = access.address;

  // Step 2 – build a signed challenge message.
  //   The message intentionally includes:
  //     • the app origin — so a captured signature cannot be replayed on a
  //       different domain.
  //     • an expiry — so a captured signature cannot be replayed days later.
  //     • a random nonce — so two sign-ins at the same second are distinct.
  const origin = typeof window !== "undefined" ? window.location.origin : "callora";
  const issuedAt = new Date().toISOString();
  // Expiry 5 minutes ahead — the backend enforces its own window.
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const nonce = generateNonce();

  const message = [
    `Sign in to Callora`,
    `Origin: ${origin}`,
    `Address: ${walletAddress}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
    `Nonce: ${nonce}`,
  ].join("\n");

  // Step 3 – sign with Freighter.
  let signResult: Awaited<ReturnType<typeof signMessage>>;
  try {
    signResult = await signMessage(message, { address: walletAddress });
  } catch (err) {
    if (isUserRejection(err)) {
      throw new AuthServiceError("SIGNATURE_REJECTED", "Signature rejected by the user.");
    }
    throw new AuthServiceError("WALLET_ERROR", "Freighter could not sign the message.");
  }

  if (signResult.error) {
    if (isUserRejection(signResult.error)) {
      throw new AuthServiceError("SIGNATURE_REJECTED", "Signature rejected by the user.");
    }
    throw new AuthServiceError("WALLET_ERROR", "Freighter could not sign the message.");
  }

  if (!signResult.signedMessage) {
    throw new AuthServiceError("WALLET_ERROR", "Freighter returned an empty signature.");
  }

  // Step 4 – exchange for tokens.
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/auth/wallet"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // Never log the body; it contains a signature.
      body: JSON.stringify({
        walletAddress,
        signature: signResult.signedMessage,
        message,
      }),
    });
  } catch {
    throw new AuthServiceError("NETWORK_ERROR", "Could not reach the Callora API. Check your connection.");
  }

  if (!response.ok) {
    let code: AuthServiceErrorCode = "AUTH_FAILED";
    if (response.status === 401 || response.status === 403) code = "AUTH_FAILED";
    else if (response.status >= 500) code = "NETWORK_ERROR";
    throw new AuthServiceError(code, `Authentication failed (${response.status}).`);
  }

  let body: WalletLoginResponse;
  try {
    body = (await response.json()) as WalletLoginResponse;
  } catch {
    throw new AuthServiceError("NETWORK_ERROR", "Unexpected response from the Callora API.");
  }

  const { accessToken, refreshToken } = extractTokens(body);

  // Persist tokens.
  _accessToken = accessToken;
  if (refreshToken) saveRefreshToken(refreshToken);

  return { accessToken, walletAddress };
}

/**
 * Refresh the access token using the stored refresh token.
 *
 * Called automatically by `authFetch` on a 401; external callers can use it
 * too (e.g. on app load to restore a session from sessionStorage).
 *
 * Returns the new access token, or throws if the refresh fails (which callers
 * should treat as a sign-out).
 */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) {
    throw new AuthServiceError("NO_REFRESH_TOKEN", "No refresh token is available.");
  }

  let response: Response;
  try {
    response = await fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new AuthServiceError("NETWORK_ERROR", "Could not reach the Callora API while refreshing.");
  }

  if (!response.ok) {
    // Token is dead — clear everything so the caller can show the sign-in UI.
    _accessToken = null;
    clearRefreshToken();
    throw new AuthServiceError("AUTH_FAILED", `Token refresh failed (${response.status}).`);
  }

  let body: WalletLoginResponse;
  try {
    body = (await response.json()) as WalletLoginResponse;
  } catch {
    _accessToken = null;
    clearRefreshToken();
    throw new AuthServiceError("NETWORK_ERROR", "Unexpected response during token refresh.");
  }

  const { accessToken, refreshToken: newRefreshToken } = extractTokens(body);

  _accessToken = accessToken;
  if (newRefreshToken) saveRefreshToken(newRefreshToken);

  return accessToken;
}

/**
 * Sign out. Calls POST /api/auth/revoke to invalidate the refresh token on the
 * backend, then clears local state regardless of whether the revoke succeeded
 * (network failure should not leave the user stuck in a signed-in state).
 */
export async function signOut(): Promise<void> {
  const refreshToken = loadRefreshToken();

  if (refreshToken) {
    try {
      await fetch(apiUrl("/api/auth/revoke"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Revoke is best-effort — clear local state regardless.
    }
  }

  _accessToken = null;
  clearRefreshToken();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Generate a URL-safe random nonce using `crypto.getRandomValues`.
 *
 * 16 bytes → 22 base64url characters, which gives 128 bits of entropy and is
 * more than sufficient to prevent nonce collisions.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Convert to base64url without padding (RFC 4648 §5).
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function isUserRejection(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error.toLowerCase()
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message).toLowerCase()
        : "";

  const code =
    error && typeof error === "object" && "code" in error
      ? Number((error as { code: unknown }).code)
      : Number.NaN;

  return (
    code === 4001 ||
    message.includes("reject") ||
    message.includes("declin") ||
    message.includes("cancel") ||
    message.includes("user denied")
  );
}

/** Extract tokens from the backend response envelope. */
function extractTokens(body: WalletLoginResponse): {
  accessToken: string;
  refreshToken: string | undefined;
} {
  // The backend wraps responses in { success, data: { accessToken, refreshToken } }
  const data = body?.data ?? (body as Record<string, unknown>);
  const accessToken =
    (data as Record<string, unknown>).accessToken ??
    (body as Record<string, unknown>).accessToken;
  const refreshToken =
    (data as Record<string, unknown>).refreshToken ??
    (body as Record<string, unknown>).refreshToken;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new AuthServiceError("NETWORK_ERROR", "Backend did not return an access token.");
  }

  return {
    accessToken,
    refreshToken: typeof refreshToken === "string" ? refreshToken : undefined,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type WalletLoginResponse = {
  success?: boolean;
  data?: {
    accessToken?: string;
    refreshToken?: string;
  };
  accessToken?: string;
  refreshToken?: string;
};

export type AuthServiceErrorCode =
  | "WALLET_UNAVAILABLE"
  | "SIGNATURE_REJECTED"
  | "AUTH_FAILED"
  | "NO_REFRESH_TOKEN"
  | "NETWORK_ERROR"
  | "WALLET_ERROR";

export class AuthServiceError extends Error {
  readonly code: AuthServiceErrorCode;

  constructor(code: AuthServiceErrorCode, message: string) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
  }
}

// ─── Test helpers (never called in production) ────────────────────────────────

/** @internal Reset in-memory state between tests. */
export function _resetAuthStateForTests(): void {
  _accessToken = null;
}
