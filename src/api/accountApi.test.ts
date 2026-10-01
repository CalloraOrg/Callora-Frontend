import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAuthenticatedAccount } from "./accountApi";

afterEach(() => vi.unstubAllGlobals());

describe("fetchAuthenticatedAccount", () => {
  it("maps the authenticated profile without copying API keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, data: {
        id: 17, user_id: "user-17", name: "Example Developer",
        apiKey: "fake-server-key-must-be-ignored", timezone: "Europe/Athens",
      } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAuthenticatedAccount()).resolves.toEqual({
      id: "user-17", label: "Example Developer", timezone: "Europe/Athens",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/developers/me",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("returns null for an unauthenticated response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchAuthenticatedAccount()).resolves.toBeNull();
  });

  it("fails closed on a malformed successful profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, data: { name: "Missing id" } }),
    }));
    await expect(fetchAuthenticatedAccount()).rejects.toThrow("missing an identifier");
  });
});
