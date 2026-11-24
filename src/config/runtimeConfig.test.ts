// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { validateRuntimeConfig, loadRuntimeConfig } from "./runtimeConfig";

const CONTRACT_ID = "CB4BUGCX5LFS5KYWAO2J4ZQTALOQSGXFFAOVKKGAS32OFZLU7O7YYGHS";
const ISSUER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("validateRuntimeConfig", () => {
  it("accepts a valid payload and applies all supplied settings", () => {
    const config = validateRuntimeConfig({
      network: "testnet",
      rpcUrl: "https://rpc.example.org",
      vaultContractId: CONTRACT_ID,
      usdcIssuer: ISSUER,
      enableDemoOutcome: true,
    });

    expect(config).toMatchObject({
      network: "testnet",
      rpcUrl: "https://rpc.example.org",
      vaultContractId: CONTRACT_ID,
      usdcIssuer: ISSUER,
      enableDemoOutcome: true,
    });
  });

  it("accepts a partial payload and preserves the build-time fallback fields", () => {
    const config = validateRuntimeConfig({ vaultContractId: CONTRACT_ID });
    expect(config.vaultContractId).toBe(CONTRACT_ID);
    expect(config.network).toBe("testnet");
    expect(config.rpcUrl).toBeTruthy();
  });

  it.each([
    [{ network: "unknown" }, /network/i],
    [{ network: 1 }, /network/i],
    [{ rpcUrl: "http://rpc.example.org" }, /HTTPS/i],
    [{ rpcUrl: "not a URL" }, /RPC URL/i],
    [{ rpcUrl: "https://user:pass@rpc.example.org" }, /HTTPS/i],
    [{ vaultContractId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }, /contract ID/i],
    [{ vaultContractId: "" }, /contract ID/i],
    [{ usdcIssuer: "not-an-issuer" }, /issuer/i],
    [{ enableDemoOutcome: "true" }, /demo-outcome/i],
    [{ enableDemoOutcome: 1 }, /demo-outcome/i],
    [{ privateKey: "secret" }, /unsupported field/i],
  ])("rejects invalid payload %j", (payload, error) => {
    expect(() => validateRuntimeConfig(payload)).toThrow(error);
  });

  it("requires an explicit vault id when switching to mainnet", () => {
    const networkSettings = {
      network: "mainnet",
      rpcUrl: "https://rpc.example.org",
      usdcIssuer: ISSUER,
    };
    expect(() => validateRuntimeConfig(networkSettings)).toThrow(/explicit vault/i);
    expect(() => validateRuntimeConfig({ ...networkSettings, vaultContractId: CONTRACT_ID }))
      .not.toThrow();
  });

  it("rejects non-object payloads", () => {
    expect(() => validateRuntimeConfig(null)).toThrow(/object/i);
    expect(() => validateRuntimeConfig([])).toThrow(/object/i);
  });
});

describe("loadRuntimeConfig", () => {
  it("fetches GET /api/config and returns a validated config", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vaultContractId: CONTRACT_ID }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const config = await loadRuntimeConfig();
    expect(fetchMock).toHaveBeenCalledWith("/api/config", expect.objectContaining({ method: "GET" }));
    expect(config.vaultContractId).toBe(CONTRACT_ID);
  });

  it("aborts the request after its timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = loadRuntimeConfig();
    const rejection = expect(request).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(3_000);
    await rejection;
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it("propagates an external abort signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = loadRuntimeConfig(controller.signal);
    controller.abort();
    await expect(request).rejects.toThrow();
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it("rejects non-JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError("bad json"); },
    }));

    await expect(loadRuntimeConfig()).rejects.toThrow(/valid JSON/i);
  });
});
