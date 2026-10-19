import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

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
