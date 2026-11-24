// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoist mocks so vi.mock factories can reference them ──────────────────────
const mocks = vi.hoisted(() => ({
  requestAccess: vi.fn(),
  signMessage: vi.fn(),
  fetch: vi.fn(),
  apiUrl: vi.fn((path: string) => path),
}));

vi.mock("@stellar/freighter-api", () => ({
  requestAccess: mocks.requestAccess,
  signMessage: mocks.signMessage,
}));

vi.mock("../config/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config/constants")>()),
  apiUrl: mocks.apiUrl,
}));

// ─── Module under test (imported after mocks are set up) ──────────────────────
import {
  signIn,
  signOut,
  getAccessToken,
  isSignedIn,
  refreshAccessToken,
  _resetAuthStateForTests,
  AuthServiceError,
} from "./authService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WALLET_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const ACCESS_TOKEN = "access-token-abc";
const REFRESH_TOKEN = "refresh-token-xyz";

function makeAuthResponse(
  accessToken = ACCESS_TOKEN,
  refreshToken = REFRESH_TOKEN,
) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { accessToken, refreshToken } }),
  };
}

function makeErrorResponse(status: number) {
  return { ok: false, status, json: async () => ({}) };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAuthStateForTests();
    sessionStorage.clear();

    vi.stubGlobal("fetch", mocks.fetch);
    mocks.apiUrl.mockImplementation((path: string) => path);

    // Default: happy-path Freighter responses
    mocks.requestAccess.mockResolvedValue({ address: WALLET_ADDRESS });
    mocks.signMessage.mockResolvedValue({ signedMessage: "sig-bytes", error: null });
    mocks.fetch.mockResolvedValue(makeAuthResponse());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Scenario 1: signIn happy path ────────────────────────────────────────
  describe("signIn – happy path", () => {
    it("POSTs to /api/auth/wallet with walletAddress, signature and message", async () => {
      await signIn();

      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/auth/wallet");
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body as string);
      expect(body.walletAddress).toBe(WALLET_ADDRESS);
      expect(typeof body.signature).toBe("string");
      expect(typeof body.message).toBe("string");
    });

    it("stores the access token in memory only (never in localStorage)", async () => {
      await signIn();

      expect(getAccessToken()).toBe(ACCESS_TOKEN);
      expect(isSignedIn()).toBe(true);

      // Check localStorage has no token key
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) ?? "";
        const value = localStorage.getItem(key) ?? "";
        expect(value).not.toContain(ACCESS_TOKEN);
      }
    });

    it("stores the refresh token in sessionStorage", async () => {
      await signIn();
      const stored = sessionStorage.getItem("callora-refresh-token");
      expect(stored).toBe(REFRESH_TOKEN);
    });

    it("returns the walletAddress and accessToken", async () => {
      const result = await signIn();
      expect(result.walletAddress).toBe(WALLET_ADDRESS);
      expect(result.accessToken).toBe(ACCESS_TOKEN);
    });

    it("includes origin, expiry and nonce in the signed message", async () => {
      await signIn();
      const body = JSON.parse(
        (mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.message).toMatch(/Origin:/);
      expect(body.message).toMatch(/Expires At:/);
      expect(body.message).toMatch(/Nonce:/);
      expect(body.message).toMatch(/Address:/);
    });
  });

  // ─── Scenario 2: user rejects signMessage ─────────────────────────────────
  describe("signIn – user rejects signature", () => {
    it("does not send any request to the backend", async () => {
      mocks.signMessage.mockResolvedValue({ error: "User rejected" });

      await expect(signIn()).rejects.toMatchObject({ code: "SIGNATURE_REJECTED" });
      expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("leaves the session signed out", async () => {
      mocks.signMessage.mockRejectedValue({ message: "User rejected the request", code: 4001 });

      await expect(signIn()).rejects.toBeInstanceOf(AuthServiceError);
      expect(isSignedIn()).toBe(false);
      expect(getAccessToken()).toBeNull();
    });
  });

  // ─── requestAccess failure ─────────────────────────────────────────────────
  describe("signIn – wallet unavailable", () => {
    it("throws WALLET_UNAVAILABLE when requestAccess returns an error", async () => {
      mocks.requestAccess.mockResolvedValue({ error: "No wallet", address: undefined });

      await expect(signIn()).rejects.toMatchObject({ code: "WALLET_UNAVAILABLE" });
    });

    it("throws WALLET_UNAVAILABLE when requestAccess returns no address", async () => {
      mocks.requestAccess.mockResolvedValue({ address: "" });

      await expect(signIn()).rejects.toMatchObject({ code: "WALLET_UNAVAILABLE" });
    });
  });

  // ─── Backend error during signIn ──────────────────────────────────────────
  describe("signIn – backend errors", () => {
    it("throws AUTH_FAILED on a 401 response", async () => {
      mocks.fetch.mockResolvedValue(makeErrorResponse(401));

      await expect(signIn()).rejects.toMatchObject({ code: "AUTH_FAILED" });
      expect(isSignedIn()).toBe(false);
    });

    it("throws NETWORK_ERROR on a 500 response", async () => {
      mocks.fetch.mockResolvedValue(makeErrorResponse(500));

      await expect(signIn()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    });

    it("throws NETWORK_ERROR when fetch rejects (network failure)", async () => {
      mocks.fetch.mockRejectedValue(new Error("Failed to fetch"));

      await expect(signIn()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    });
  });

  // ─── getAccessToken / isSignedIn ──────────────────────────────────────────
  describe("getAccessToken / isSignedIn", () => {
    it("returns null and false before sign-in", () => {
      expect(getAccessToken()).toBeNull();
      expect(isSignedIn()).toBe(false);
    });

    it("returns the token and true after sign-in", async () => {
      await signIn();
      expect(getAccessToken()).toBe(ACCESS_TOKEN);
      expect(isSignedIn()).toBe(true);
    });
  });

  // ─── signOut ──────────────────────────────────────────────────────────────
  describe("signOut", () => {
    it("clears the token and sessionStorage after sign-out", async () => {
      await signIn();
      expect(isSignedIn()).toBe(true);

      mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await signOut();

      expect(isSignedIn()).toBe(false);
      expect(getAccessToken()).toBeNull();
      expect(sessionStorage.getItem("callora-refresh-token")).toBeNull();
    });

    it("clears local state even when revoke call fails", async () => {
      await signIn();
      mocks.fetch.mockRejectedValue(new Error("Network error"));

      await signOut();

      expect(isSignedIn()).toBe(false);
      expect(getAccessToken()).toBeNull();
    });
  });

  // ─── refreshAccessToken ───────────────────────────────────────────────────
  describe("refreshAccessToken", () => {
    it("throws NO_REFRESH_TOKEN when sessionStorage is empty", async () => {
      await expect(refreshAccessToken()).rejects.toMatchObject({
        code: "NO_REFRESH_TOKEN",
      });
    });

    it("updates the in-memory token on a successful refresh", async () => {
      // Seed a refresh token in sessionStorage.
      sessionStorage.setItem("callora-refresh-token", REFRESH_TOKEN);
      const newToken = "new-access-token";
      mocks.fetch.mockResolvedValue(makeAuthResponse(newToken));

      const result = await refreshAccessToken();

      expect(result).toBe(newToken);
      expect(getAccessToken()).toBe(newToken);
    });

    it("clears state and throws on a 401 from the refresh endpoint", async () => {
      sessionStorage.setItem("callora-refresh-token", REFRESH_TOKEN);
      mocks.fetch.mockResolvedValue(makeErrorResponse(401));

      await expect(refreshAccessToken()).rejects.toMatchObject({
        code: "AUTH_FAILED",
      });
      expect(getAccessToken()).toBeNull();
      expect(sessionStorage.getItem("callora-refresh-token")).toBeNull();
    });
  });

  // ─── Scenario 8: localStorage never contains a token key ──────────────────
  describe("localStorage isolation", () => {
    it("never writes any token to localStorage", async () => {
      await signIn();
      mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      await signOut();

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) ?? "";
        expect(key).not.toMatch(/token/i);
        expect(key).not.toMatch(/callora-refresh/);
        expect(key).not.toMatch(/access/i);
      }
    });
  });

  // ─── Response envelope variants ───────────────────────────────────────────
  describe("signIn – response envelope variants", () => {
    it("accepts a flat response body (top-level accessToken / refreshToken)", async () => {
      // Some backends return { accessToken, refreshToken } directly, not wrapped in data.
      mocks.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN }),
      });

      const result = await signIn();
      expect(result.accessToken).toBe(ACCESS_TOKEN);
      expect(getAccessToken()).toBe(ACCESS_TOKEN);
    });

    it("throws NETWORK_ERROR when the response contains no access token", async () => {
      mocks.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await expect(signIn()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    });
  });

  // ─── signIn – string error from signMessage ────────────────────────────────
  describe("signIn – string rejection from signMessage", () => {
    it("throws SIGNATURE_REJECTED when signMessage throws a string 'User denied'", async () => {
      mocks.signMessage.mockRejectedValue("user denied the request");

      await expect(signIn()).rejects.toMatchObject({ code: "SIGNATURE_REJECTED" });
      expect(mocks.fetch).not.toHaveBeenCalled();
    });
  });

  // ─── refreshAccessToken – response without refreshToken ───────────────────
  describe("refreshAccessToken – response without new refreshToken", () => {
    it("still succeeds if the backend omits refreshToken on refresh", async () => {
      sessionStorage.setItem("callora-refresh-token", REFRESH_TOKEN);
      mocks.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { accessToken: "new-token" } }),
      });

      const result = await refreshAccessToken();
      expect(result).toBe("new-token");
    });
  });

  // ─── signOut – no refresh token stored ────────────────────────────────────
  describe("signOut – no refresh token stored", () => {
    it("succeeds silently when there is nothing to revoke", async () => {
      // Nothing in sessionStorage — should not call fetch.
      await signOut();
      // revoke is not called when there's no refresh token
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(isSignedIn()).toBe(false);
    });
  });
});
