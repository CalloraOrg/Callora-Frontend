import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("API base URL and path normalization", () => {
  it("normalizes base URL by trimming whitespace and trailing slashes", async () => {
    const { normalizeBaseUrl } = await import("./constants");
    expect(normalizeBaseUrl(undefined)).toBe("");
    expect(normalizeBaseUrl("")).toBe("");
    expect(normalizeBaseUrl("   ")).toBe("");
    expect(normalizeBaseUrl("https://api.example.com")).toBe("https://api.example.com");
    expect(normalizeBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(normalizeBaseUrl("https://api.example.com///")).toBe("https://api.example.com");
    expect(normalizeBaseUrl("  https://api.example.com//  ")).toBe("https://api.example.com");
  });

  it("normalises trailing slashes from VITE_API_BASE_URL into API_BASE and apiUrl", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/");
    vi.resetModules();
    let config = await import("./constants");
    expect(config.API_BASE).toBe("https://api.example.com");
    expect(config.IS_BACKEND_MODE).toBe(true);
    expect(config.apiUrl("/api/x")).toBe("https://api.example.com/api/x");
    expect(config.apiUrl("api/x")).toBe("https://api.example.com/api/x");

    vi.stubEnv("VITE_API_BASE_URL", " https://api.example.com// ");
    vi.resetModules();
    config = await import("./constants");
    expect(config.API_BASE).toBe("https://api.example.com");
    expect(config.IS_BACKEND_MODE).toBe(true);
    expect(config.apiUrl("/api/x")).toBe("https://api.example.com/api/x");
    expect(config.apiUrl("api/x")).toBe("https://api.example.com/api/x");
  });

  it("keeps relative paths when VITE_API_BASE_URL is empty", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    const config = await import("./constants");
    expect(config.API_BASE).toBe("");
    expect(config.IS_BACKEND_MODE).toBe(false);
    expect(config.apiUrl("/api/x")).toBe("/api/x");
    expect(config.apiUrl("api/x")).toBe("/api/x");
  });
});

describe("USDC asset configuration", () => {
  it("defaults to the deployed testnet asset", async () => {
    vi.stubEnv("VITE_STELLAR_NETWORK", "testnet");
    vi.stubEnv("VITE_STELLAR_USDC_ISSUER", undefined);
    delete import.meta.env.VITE_STELLAR_USDC_ISSUER;
    delete process.env.VITE_STELLAR_USDC_ISSUER;
    vi.resetModules();
    const config = await import("./constants");
    expect(config.STELLAR_USDC_ASSET).toEqual({ code: "USDC", issuer: "GDXDZNSTNORCX4373EGGYS4Q3U3XVZMBSIMMRHG5S5GCCF7JHC7QZWAZ" });
    expect(config.STELLAR_USDC_CONFIGURATION_ERROR).toBeNull();
  });

  it("rejects an invalid issuer env before making any Horizon call", async () => {
    vi.stubEnv("VITE_STELLAR_USDC_ISSUER", "invalid-key");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      const { hasUsdcTrustline, addUsdcTrustline } = await import("../services/walletService");
      await expect(hasUsdcTrustline("GACCOUNT")).rejects.toMatchObject({ code: "CONFIGURATION" });
      await expect(addUsdcTrustline()).rejects.toMatchObject({ code: "CONFIGURATION" });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });

  it.each(["mainnet", "futurenet"])("requires an explicit issuer on %s and honors a valid override", async (network) => {
    vi.stubEnv("VITE_STELLAR_NETWORK", network);
    vi.stubEnv("VITE_STELLAR_USDC_ISSUER", undefined);
    delete import.meta.env.VITE_STELLAR_USDC_ISSUER;
    delete process.env.VITE_STELLAR_USDC_ISSUER;
    vi.resetModules();
    expect((await import("./constants")).STELLAR_USDC_CONFIGURATION_ERROR).toMatch(/valid Stellar Ed25519/);
    vi.stubEnv("VITE_STELLAR_USDC_ISSUER", " GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF ");
    vi.resetModules();
    const config = await import("./constants");
    expect(config.STELLAR_USDC_ASSET.issuer).toBe("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    expect(config.STELLAR_USDC_CONFIGURATION_ERROR).toBeNull();
    expect(config.STELLAR_HORIZON_URL).toBe(network === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-futurenet.stellar.org");
  });
});
