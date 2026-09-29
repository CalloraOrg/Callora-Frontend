// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
  serverConstructor: vi.fn(),
  server: {
    getAccount: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    getTransaction: vi.fn(),
  },
  transactionBuilder: vi.fn(),
  operation: undefined as unknown,
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: mocks.isConnected,
  requestAccess: mocks.requestAccess,
  getNetwork: mocks.getNetwork,
  signTransaction: mocks.signTransaction,
}));

vi.mock("@stellar/stellar-sdk", () => {
  class Address {
    toScVal() {
      return "address-scval";
    }
  }

  class Contract {
    call(method: string, ...args: unknown[]) {
      return { method, args };
    }
  }

  class TransactionBuilder {
    constructor() {
      mocks.transactionBuilder();
    }
    addOperation(operation: unknown) {
      mocks.operation = operation;
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return { toXDR: () => "unsigned-xdr" };
    }
  }

  class Transaction {
    constructor(public xdr: string, public passphrase: string) {}
  }

  class Server {
    constructor(...args: unknown[]) {
      mocks.serverConstructor(...args);
      return mocks.server;
    }
  }

  return {
    Address,
    BASE_FEE: "100",
    Contract,
    Networks: {
      PUBLIC: "Public Global Stellar Network ; September 2015",
      TESTNET: "Test SDF Network ; September 2015",
    },
    Transaction,
    TransactionBuilder,
    nativeToScVal: (value: unknown, options: unknown) => ({ value, options }),
    rpc: {
      Server,
      Api: {
        GetTransactionStatus: {
          SUCCESS: "SUCCESS",
          FAILED: "FAILED",
          NOT_FOUND: "NOT_FOUND",
        },
      },
    },
  };
});

vi.mock("../config/constants", () => ({
  STELLAR_NETWORK: "TESTNET",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_USDC_DECIMALS: 7,
  STELLAR_VAULT_CONTRACT_ID: "CVAULTTESTCONTRACTID",
}));

import {
  isWalletAvailable,
  submitVaultDeposit,
} from "./walletService";

describe("walletService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operation = undefined;
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.requestAccess.mockResolvedValue({ address: "GUSERACCOUNT" });
    mocks.getNetwork.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    mocks.signTransaction.mockResolvedValue({
      signedTxXdr: "signed-xdr",
      signerAddress: "GUSERACCOUNT",
    });
    mocks.server.getAccount.mockResolvedValue({ accountId: "GUSERACCOUNT" });
    mocks.server.prepareTransaction.mockResolvedValue({
      toXDR: () => "prepared-xdr",
    });
    mocks.server.sendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "HASH_RETURNED_BY_STELLAR",
    });
    mocks.server.getTransaction.mockResolvedValue({ status: "SUCCESS" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      "prepared-xdr",
      expect.objectContaining({ address: "GUSERACCOUNT" }),
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
});
