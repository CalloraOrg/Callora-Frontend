// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
  fetch: vi.fn(),
  configurationError: null as string | null,
  serverConstructor: vi.fn(),
  server: {
    getAccount: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
  },
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: mocks.isConnected,
  requestAccess: mocks.requestAccess,
  getNetwork: mocks.getNetwork,
  signTransaction: mocks.signTransaction,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return { ...actual, rpc: { ...actual.rpc, Server: class {
    constructor(...args: unknown[]) {
      mocks.serverConstructor(...args);
      return mocks.server;
    }
  } } };
});
vi.mock("../config/constants", async (importOriginal) => ({
  ...await importOriginal<typeof import("../config/constants")>(),
  STELLAR_NETWORK: "testnet",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_USDC_DECIMALS: 7,
  STELLAR_VAULT_CONTRACT_ID: "CBJZLUKQBWDMZPKNJAVONZ7GCCWADSETRXWOPN5Z3XWAUNI4F2R7XDYQ",
  get STELLAR_USDC_CONFIGURATION_ERROR() { return mocks.configurationError; },
}));

import { Account, Asset, Transaction } from "@stellar/stellar-sdk";
import { STELLAR_USDC_ASSET, STELLAR_NETWORK_PASSPHRASE } from "../config/constants";
const walletAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
import {
  hasUsdcTrustline, addUsdcTrustline, getWalletAddress,
  isWalletAvailable,
  submitVaultDeposit,
} from "./walletService";

describe("walletService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configurationError = null;
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.fetch.mockReset().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ sequence: "123", balances: [{ asset_code: "USDC", asset_issuer: STELLAR_USDC_ASSET.issuer }] }),
    });
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.requestAccess.mockResolvedValue({ address: walletAddress });
    mocks.getNetwork.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    mocks.signTransaction.mockImplementation(async (xdr: string) => ({ signedTxXdr: xdr, signerAddress: walletAddress }));
    mocks.server.getAccount.mockImplementation(async () => new Account(walletAddress, "123"));
    mocks.server.prepareTransaction.mockImplementation(async (transaction: Transaction) => transaction);
    mocks.server.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "HASH_RETURNED_BY_STELLAR",
    });
    mocks.server.getTransaction.mockResolvedValue({ status: "SUCCESS" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("detects when Freighter is missing", async () => {
    mocks.isConnected.mockResolvedValue({ isConnected: false });

    await expect(isWalletAvailable()).resolves.toBe(false);
  });

  it("signs, submits, and waits for the network hash to confirm", async () => {
    const onSubmitted = vi.fn();

    await expect(submitVaultDeposit("12.34", onSubmitted)).resolves.toEqual({
      hash: "HASH_RETURNED_BY_STELLAR",
    });

    expect(onSubmitted).toHaveBeenCalledWith("HASH_RETURNED_BY_STELLAR");
    expect(mocks.signTransaction).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ address: walletAddress }),
    );
    expect(mocks.server.sendTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.server.getTransaction).toHaveBeenCalledWith(
      "HASH_RETURNED_BY_STELLAR",
    );
  });

  it("maps a rejected signature to a distinct failure", async () => {
    mocks.signTransaction.mockResolvedValue({
      error: { code: 4001, message: "User rejected the signature" },
    });

    await expect(submitVaultDeposit("12.34")).rejects.toMatchObject({
      code: "SIGNATURE_REJECTED",
      message: expect.stringContaining("Signature rejected"),
    });
    expect(mocks.server.sendTransaction).not.toHaveBeenCalled();
  });

  it("does not attempt access when the wallet extension is missing", async () => {
    mocks.isConnected.mockResolvedValue({ isConnected: false });

    await expect(submitVaultDeposit("12.34")).rejects.toMatchObject({
      code: "WALLET_UNAVAILABLE",
    });
    expect(mocks.requestAccess).not.toHaveBeenCalled();
  });

  it("rejects a wallet connected to a different Stellar network", async () => {
    mocks.getNetwork.mockResolvedValue({
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    await expect(submitVaultDeposit("12.34")).rejects.toMatchObject({
      code: "NETWORK_MISMATCH",
    });
    expect(mocks.server.sendTransaction).not.toHaveBeenCalled();
  });

  it("reports a transaction confirmation timeout distinctly", async () => {
    mocks.server.getTransaction.mockResolvedValue({ status: "NOT_FOUND" });
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      now += 31_000;
      return now;
    });

    await expect(submitVaultDeposit("12.34")).rejects.toMatchObject({
      code: "NETWORK_TIMEOUT",
      message: expect.stringContaining("Network confirmation timed out"),
    });
  });

  it("blocks retries when submission returned no hash to reconcile", async () => {
    mocks.server.sendTransaction.mockResolvedValue({ status: "PENDING" });

    await expect(submitVaultDeposit("12.34")).rejects.toMatchObject({
      code: "NETWORK_TIMEOUT",
      requiresReconciliation: true,
      message: expect.stringContaining("without returning a transaction hash"),
    });
  });

  it("does not silently round amounts beyond Stellar USDC precision", async () => {
    await expect(submitVaultDeposit("12.00000001")).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
    expect(mocks.requestAccess).not.toHaveBeenCalled();
  });

  it("matches both the code and issuer, including a zero-balance trustline", async () => {
    expect(await hasUsdcTrustline(walletAddress)).toBe("present");
    expect(mocks.fetch).toHaveBeenCalledWith(
      `https://horizon-testnet.stellar.org/accounts/${walletAddress}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ balances: [
      { asset_type: "native" }, null,
      { asset_code: "USDC", asset_issuer: walletAddress },
      { asset_code: "OTHER", asset_issuer: STELLAR_USDC_ASSET.issuer },
    ] }) });
    expect(await hasUsdcTrustline(walletAddress)).toBe("missing");
  });

  it("distinguishes an unfunded account from HTTP errors and malformed responses", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await hasUsdcTrustline(walletAddress)).toBe("unfunded-account");
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await hasUsdcTrustline(walletAddress)).toBe("unknown");
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    expect(await hasUsdcTrustline(walletAddress)).toBe("unknown");
    mocks.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await hasUsdcTrustline(walletAddress)).toBe("unknown");
  });

  it("aborts a stalled Horizon lookup and reports unknown", async () => {
    vi.useFakeTimers();
    try {
      mocks.fetch.mockImplementationOnce((_url: string, { signal }: RequestInit) => new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }));
      const check = hasUsdcTrustline(walletAddress);
      await vi.advanceTimersByTimeAsync(8_000);
      expect(await check).toBe("unknown");
    } finally { vi.useRealTimers(); }
  });

  it("rejects invalid issuer configuration before Horizon or Freighter calls", async () => {
    mocks.configurationError = "Configure VITE_STELLAR_USDC_ISSUER with a valid Stellar Ed25519 public key for this network.";
    await expect(hasUsdcTrustline(walletAddress)).rejects.toMatchObject({ code: "CONFIGURATION" });
    await expect(addUsdcTrustline()).rejects.toMatchObject({ code: "CONFIGURATION" });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.requestAccess).not.toHaveBeenCalled();
  });

  it("signs exactly one changeTrust for the configured asset and waits for Horizon success", async () => {
    let confirm!: (value: unknown) => void;
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ sequence: "123" }) })
      .mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    let completed = false;
    const add = addUsdcTrustline().then((result) => { completed = true; return result; });
    await vi.waitFor(() => expect(mocks.signTransaction).toHaveBeenCalledOnce());
    const [xdr, options] = mocks.signTransaction.mock.calls[0];
    const transaction = new Transaction(xdr, STELLAR_NETWORK_PASSPHRASE);
    expect(transaction.source).toBe(walletAddress);
    expect(transaction.sequence).toBe("124");
    expect(transaction.operations).toHaveLength(1);
    const operation = transaction.operations[0];
    expect(operation.type).toBe("changeTrust");
    if (operation.type !== "changeTrust") throw new Error("Expected changeTrust");
    if (!(operation.line instanceof Asset)) throw new Error("Expected a classic asset");
    expect(operation.line.getCode()).toBe(STELLAR_USDC_ASSET.code);
    expect(operation.line.getIssuer()).toBe(STELLAR_USDC_ASSET.issuer);
    expect(options).toEqual({ address: walletAddress, networkPassphrase: STELLAR_NETWORK_PASSPHRASE });
    expect(mocks.fetch).toHaveBeenLastCalledWith("https://horizon-testnet.stellar.org/transactions", expect.objectContaining({
      method: "POST", body: new URLSearchParams({ tx: xdr }).toString(),
    }));
    expect(completed).toBe(false);
    confirm({ ok: true, json: async () => ({ successful: true }) });
    expect(await add).toBe("present");
    expect(await hasUsdcTrustline(walletAddress)).toBe("present");
  });

  it.each(["returned", "thrown"])("treats a %s signature rejection as cancellation", async (kind) => {
    const rejection = { code: 4001, message: "User declined" };
    if (kind === "returned") mocks.signTransaction.mockResolvedValueOnce({ error: rejection });
    else mocks.signTransaction.mockRejectedValueOnce(rejection);
    expect(await addUsdcTrustline()).toBe("cancelled");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("treats rejected wallet access as cancellation", async () => {
    mocks.requestAccess.mockRejectedValueOnce({ code: 4001 });
    expect(await addUsdcTrustline()).toBe("cancelled");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not submit an empty signature or one from a different account", async () => {
    mocks.signTransaction.mockResolvedValueOnce({ signedTxXdr: "" });
    await expect(addUsdcTrustline()).rejects.toMatchObject({ code: "WALLET_ERROR" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([404, 503])("handles Horizon account status %s before signing", async (status) => {
    mocks.fetch.mockResolvedValueOnce({ ok: false, status });
    await expect(addUsdcTrustline()).rejects.toMatchObject({ code: status === 404 ? "UNFUNDED_ACCOUNT" : "NETWORK_ERROR" });
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it.each([false, true])("reports a failed trustline transaction (HTTP success: %s)", async (ok) => {
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ sequence: "123" }) })
      .mockResolvedValueOnce({ ok, json: async () => ({ successful: false }) });
    await expect(addUsdcTrustline()).rejects.toMatchObject({ code: "TRANSACTION_FAILED" });
  });

  it("reports a lost submission response without claiming the trustline is present", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ sequence: "123" }) })
      .mockRejectedValueOnce(new Error("network lost"));
    await expect(addUsdcTrustline()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("checks the selected account again before Soroban simulation", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ balances: [] }) });
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "TRUSTLINE_MISSING" });
    expect(mocks.server.prepareTransaction).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "UNFUNDED_ACCOUNT" });
  });

  it("allows deposit simulation when Horizon cannot check the trustline", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(submitVaultDeposit("50")).resolves.toHaveProperty("hash");
  });

  it("handles missing addresses, network errors, and a missing extension", async () => {
    mocks.requestAccess.mockResolvedValueOnce({ address: "" });
    await expect(getWalletAddress()).rejects.toMatchObject({ code: "WALLET_UNAVAILABLE" });
    mocks.getNetwork.mockResolvedValueOnce({ error: { message: "wallet error" } });
    await expect(getWalletAddress()).rejects.toMatchObject({ code: "WALLET_ERROR" });
    mocks.isConnected.mockRejectedValueOnce(new Error("not installed"));
    await expect(getWalletAddress()).rejects.toMatchObject({ code: "WALLET_UNAVAILABLE" });
  });

  it.each(["timeout", "connection lost"])("preserves pre-submission RPC error handling (%s)", async (message) => {
    mocks.server.getAccount.mockRejectedValueOnce(new Error(message));
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "NETWORK_ERROR", requiresReconciliation: false });
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it("does not request a deposit signature if simulation fails", async () => {
    mocks.server.prepareTransaction.mockRejectedValueOnce(new Error("simulation failed"));
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(mocks.signTransaction).not.toHaveBeenCalled();
  });

  it("does not submit a deposit signed by another account", async () => {
    mocks.signTransaction.mockResolvedValueOnce({ signedTxXdr: "xdr", signerAddress: STELLAR_USDC_ASSET.issuer });
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "WALLET_ERROR" });
    expect(mocks.server.sendTransaction).not.toHaveBeenCalled();
  });

  it.each(["ERROR", "TRY_AGAIN_LATER"])("preserves definitive RPC submission failures (%s)", async (status) => {
    mocks.server.sendTransaction.mockResolvedValueOnce({ status });
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "TRANSACTION_FAILED", requiresReconciliation: false });
  });

  it.each(["timeout", "connection lost"])("requires reconciliation after a lost RPC response (%s)", async (message) => {
    mocks.server.sendTransaction.mockRejectedValueOnce(new Error(message));
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "NETWORK_TIMEOUT", requiresReconciliation: true });
  });

  it("requires reconciliation after losing confirmation access", async () => {
    mocks.server.getTransaction.mockRejectedValueOnce(new Error("offline"));
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "NETWORK_TIMEOUT", requiresReconciliation: true });
  });

  it("reports a definitive failed deposit without requiring reconciliation", async () => {
    mocks.server.getTransaction.mockResolvedValueOnce({ status: "FAILED" });
    await expect(submitVaultDeposit("50")).rejects.toMatchObject({ code: "TRANSACTION_FAILED", requiresReconciliation: false });
  });
});
