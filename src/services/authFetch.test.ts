// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn<[], string | null>(),
  refreshAccessToken: vi.fn<[], Promise<string>>(),
  signOut: vi.fn<[], Promise<void>>(),
  signalExpiry: vi.fn(),
  apiUrl: vi.fn((path: string) => path),
  fetch: vi.fn(),
}));

vi.mock("./authService", () => ({
  getAccessToken: mocks.getAccessToken,
  refreshAccessToken: mocks.refreshAccessToken,
  signOut: mocks.signOut,
}));

vi.mock("./sessionExpiry", () => ({
  signalExpiry: mocks.signalExpiry,
}));

vi.mock("../config/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config/constants")>()),
  apiUrl: mocks.apiUrl,
}));

// ─── Module under test ────────────────────────────────────────────────────────
import {
  authFetch,
  _resetRefreshPromiseForTests,
} from "./authFetch";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCESS_TOKEN = "access-token-abc";
const NEW_ACCESS_TOKEN = "access-token-refreshed";

function okResponse(status = 200) {
  return { ok: true, status, json: async () => ({}) };
}

function unauthorizedResponse() {
  return { ok: false, status: 401, json: async () => ({}) };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("authFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRefreshPromiseForTests();

    vi.stubGlobal("fetch", mocks.fetch);
    mocks.apiUrl.mockImplementation((path: string) => path);
    mocks.getAccessToken.mockReturnValue(ACCESS_TOKEN);
    mocks.refreshAccessToken.mockResolvedValue(NEW_ACCESS_TOKEN);
    mocks.signOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetRefreshPromiseForTests();
  });

  // ─── Scenario 3: authFetch with a valid token ──────────────────────────────
  describe("Scenario 3 – valid token", () => {
    it("adds Authorization header to the request", async () => {
      mocks.fetch.mockResolvedValue(okResponse());

      await authFetch("/api/usage");

      const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${ACCESS_TOKEN}`);
    });

    it("builds the URL with apiUrl", async () => {
      mocks.apiUrl.mockImplementation((path: string) => `https://api.callora.com${path}`);
      mocks.fetch.mockResolvedValue(okResponse());

      await authFetch("/api/usage");

      const [url] = mocks.fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.callora.com/api/usage");
    });

    it("preserves caller-supplied headers", async () => {
      mocks.fetch.mockResolvedValue(okResponse());

      await authFetch("/api/usage", { headers: { "X-Custom": "yes" } });

      const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["X-Custom"]).toBe("yes");
    });

    it("returns the response without a refresh when status is 200", async () => {
      mocks.fetch.mockResolvedValue(okResponse(200));

      const response = await authFetch("/api/usage");

      expect(response.status).toBe(200);
      expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  // ─── Scenario 4: 401 then refresh succeeds ────────────────────────────────
  describe("Scenario 4 – 401 then refresh succeeds", () => {
    it("retries exactly once with the new token", async () => {
      mocks.fetch
        .mockResolvedValueOnce(unauthorizedResponse())
        .mockResolvedValueOnce(okResponse());

      const response = await authFetch("/api/usage");

      expect(mocks.fetch).toHaveBeenCalledTimes(2);
      expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
    });

    it("sends the new token in the Authorization header on retry", async () => {
      mocks.fetch
        .mockResolvedValueOnce(unauthorizedResponse())
        .mockResolvedValueOnce(okResponse());

      await authFetch("/api/usage");

      const [, retryInit] = mocks.fetch.mock.calls[1] as [string, RequestInit];
      const headers = retryInit.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${NEW_ACCESS_TOKEN}`);
    });
  });

  // ─── Scenario 5: Three parallel 401s share one refresh call ───────────────
  describe("Scenario 5 – three parallel 401s, one refresh", () => {
    it("calls refreshAccessToken exactly once for three concurrent 401s", async () => {
      // First call from each of the three concurrent fetches returns 401;
      // retries all return 200.
      mocks.fetch
        .mockResolvedValueOnce(unauthorizedResponse())
        .mockResolvedValueOnce(unauthorizedResponse())
        .mockResolvedValueOnce(unauthorizedResponse())
        .mockResolvedValue(okResponse());

      await Promise.all([
        authFetch("/api/usage"),
        authFetch("/api/usage"),
        authFetch("/api/usage"),
      ]);

      expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Scenario 6: Refresh fails ────────────────────────────────────────────
  describe("Scenario 6 – refresh fails", () => {
    it("clears the session and emits session-expired when refresh fails", async () => {
      mocks.fetch.mockResolvedValue(unauthorizedResponse());
      mocks.refreshAccessToken.mockRejectedValue(new Error("refresh failed"));

      await authFetch("/api/usage");

      expect(mocks.signOut).toHaveBeenCalled();
      expect(mocks.signalExpiry).toHaveBeenCalledWith("expired");
    });

    it("returns the original 401 response when refresh fails", async () => {
      mocks.fetch.mockResolvedValue(unauthorizedResponse());
      mocks.refreshAccessToken.mockRejectedValue(new Error("refresh failed"));

      const response = await authFetch("/api/usage");

      expect(response.status).toBe(401);
    });
  });

  // ─── Scenario 7: Abort during retry ──────────────────────────────────────
  describe("Scenario 7 – abort signal", () => {
    it("rejects with AbortError when aborted before the retry", async () => {
      const controller = new AbortController();

      mocks.fetch.mockResolvedValueOnce(unauthorizedResponse());
      mocks.refreshAccessToken.mockImplementation(async () => {
        // Abort during the refresh so we reach the pre-retry check.
        controller.abort();
        return NEW_ACCESS_TOKEN;
      });

      await expect(
        authFetch("/api/usage", { signal: controller.signal }),
      ).rejects.toMatchObject({ name: "AbortError" });
    });

    it("does not make a second fetch call after abort", async () => {
      const controller = new AbortController();
      controller.abort();

      // First fetch is already aborted — native fetch would throw, but our mock
      // returns a 401; what matters is that we check the signal before retrying.
      mocks.fetch.mockResolvedValueOnce(unauthorizedResponse());
      mocks.refreshAccessToken.mockResolvedValue(NEW_ACCESS_TOKEN);

      await expect(
        authFetch("/api/usage", { signal: controller.signal }),
      ).rejects.toMatchObject({ name: "AbortError" });

      // No retry attempt
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── No token: request sent without Authorization header ──────────────────
  describe("no token – unauthenticated request", () => {
    it("omits the Authorization header when no token is available", async () => {
      mocks.getAccessToken.mockReturnValue(null);
      mocks.fetch.mockResolvedValue(okResponse());

      await authFetch("/api/public");

      const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });

  // ─── Retry 401 also fails ─────────────────────────────────────────────────
  describe("retry also returns 401", () => {
    it("signs out and signals expiry when the retry also gets a 401", async () => {
      mocks.fetch.mockResolvedValue(unauthorizedResponse());

      await authFetch("/api/usage");

      // First 401 → refresh → retry → 401 → signOut + signalExpiry
      expect(mocks.signOut).toHaveBeenCalled();
      expect(mocks.signalExpiry).toHaveBeenCalledWith("expired");
    });
  });

  // ─── Scenario 9: ApiUsage carries a bearer token when signed in ───────────
  describe("Scenario 9 – ApiUsage integration", () => {
    it("attaches a bearer token to the usage request when signed in", async () => {
      mocks.getAccessToken.mockReturnValue(ACCESS_TOKEN);
      mocks.fetch.mockResolvedValue(okResponse());

      await authFetch("/api/usage?groupBy=day&limit=100", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/usage");
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${ACCESS_TOKEN}`);
    });
  });
});
