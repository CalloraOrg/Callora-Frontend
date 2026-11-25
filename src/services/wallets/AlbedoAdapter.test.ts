// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Account,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const mocks = vi.hoisted(() => ({
  publicKey: vi.fn(),
  signMessage: vi.fn(),
  tx: vi.fn(),
}));

vi.mock("@albedo-link/intent", () => ({
  default: {
    publicKey: mocks.publicKey,
    signMessage: mocks.signMessage,
    tx: mocks.tx,
  },
}));

import { albedoAdapter } from "./AlbedoAdapter";
import {
  clearSelectedWallet,
  getSelectedWalletId,
  selectWallet,
  WALLET_SELECTION_STORAGE_KEY,
  walletAdapters,
} from ".";

const passphrase = "Test SDF Network ; September 2015";

describe("wallet adapters", () => {
  let keypair: Keypair;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearSelectedWallet();
    keypair = Keypair.random();
    mocks.publicKey.mockResolvedValue({ pubkey: keypair.publicKey() });
    mocks.signMessage.mockResolvedValue({
      pubkey: keypair.publicKey(),
      message_signature: "message-signature",
    });
    mocks.tx.mockImplementation(
      async ({ xdr }: { xdr: string; network: string }) => {
        const transaction = new Transaction(xdr, passphrase);
        transaction.sign(keypair);
        return {
          signed_envelope_xdr: transaction.toXDR(),
          network: "testnet",
        };
      },
    );
  });

  afterEach(() => {
    clearSelectedWallet();
  });

  it("registers adapters with the shared connection and signing contract", () => {
    expect(walletAdapters.length).toBeGreaterThanOrEqual(2);
    for (const adapter of walletAdapters) {
      expect(adapter.id).toBeTruthy();
      expect(adapter.name).toBeTruthy();
      expect(adapter.installUrl).toMatch(/^https:\/\//);
      expect(adapter.capabilities.signMessage).toBe(true);
      expect(typeof adapter.isAvailable).toBe("function");
      expect(typeof adapter.connect).toBe("function");
      expect(typeof adapter.getNetwork).toBe("function");
      expect(typeof adapter.signTransaction).toBe("function");
      expect(typeof adapter.signMessage).toBe("function");
    }
  });

  it("persists the selected adapter and clears the preference on sign-out", () => {
    selectWallet(albedoAdapter.id);
    expect(getSelectedWalletId()).toBe("albedo");
    expect(localStorage.getItem(WALLET_SELECTION_STORAGE_KEY)).toBe("albedo");

    clearSelectedWallet();
    expect(getSelectedWalletId()).toBe("freighter");
    expect(localStorage.getItem(WALLET_SELECTION_STORAGE_KEY)).toBeNull();
  });

  it("connects, signs in, and verifies Albedo's signed transaction", async () => {
    const connection = await albedoAdapter.connect();
    const signature = await albedoAdapter.signMessage!("Sign in", {
      address: connection.address,
    });
    const transaction = new TransactionBuilder(
      new Account(connection.address, "1"),
      { fee: "100", networkPassphrase: passphrase },
    )
      .addOperation(Operation.manageData({ name: "smoke", value: "1" }))
      .setTimeout(30)
      .build();
    const signed = await albedoAdapter.signTransaction(transaction.toXDR(), {
      address: connection.address,
      networkPassphrase: passphrase,
    });

    expect(await albedoAdapter.getAddress()).toBe(connection.address);
    expect(signature).toBe("message-signature");
    expect(signed.signerAddress).toBe(connection.address);
    expect(new Transaction(signed.signedTxXdr, passphrase).signatures).toHaveLength(1);
    expect(mocks.tx).toHaveBeenCalledWith(
      expect.objectContaining({ pubkey: connection.address, network: "testnet", submit: false }),
    );
  });
});
