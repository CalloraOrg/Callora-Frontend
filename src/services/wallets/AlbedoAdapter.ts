import { Keypair, Transaction } from "@stellar/stellar-sdk";
import {
  isUserRejectedWalletError,
  WalletAdapterError,
  type WalletAdapter,
} from "./WalletAdapter";

type AlbedoIntentModule = typeof import("@albedo-link/intent");

let connectedAddress: string | null = null;
let knownNetworkPassphrase: string | null = null;

async function loadAlbedo(): Promise<AlbedoIntentModule["default"]> {
  const { default: albedo } = await import("@albedo-link/intent");
  return albedo;
}

function networkName(passphrase: string): string {
  if (passphrase === "Public Global Stellar Network ; September 2015") {
    return "public";
  }
  if (passphrase === "Test SDF Network ; September 2015") return "testnet";
  return passphrase;
}

function passphraseForAlbedoNetwork(network: string): string | null {
  const normalized = network.trim().toLowerCase();
  if (
    normalized === "public" ||
    normalized === "mainnet" ||
    normalized === "public global stellar network ; september 2015"
  ) {
    return "Public Global Stellar Network ; September 2015";
  }
  if (
    normalized === "testnet" ||
    normalized === "test sdf network ; september 2015"
  ) {
    return "Test SDF Network ; September 2015";
  }
  return network.includes(" ; ") ? network : null;
}

export const albedoAdapter: WalletAdapter = {
  id: "albedo",
  name: "Albedo",
  installUrl: "https://albedo.link/",
  capabilities: { signMessage: true },

  async isAvailable() {
    return typeof window !== "undefined" && typeof window.open === "function";
  },

  async connect() {
    try {
      const albedo = await loadAlbedo();
      const result = await albedo.publicKey({});
      if (!result.pubkey) {
        throw new WalletAdapterError(
          "Albedo did not provide an account address.",
          "UNAVAILABLE",
        );
      }
      connectedAddress = result.pubkey;
      knownNetworkPassphrase = null;
      return { address: result.pubkey };
    } catch (error) {
      if (error instanceof WalletAdapterError) throw error;
      throw mapAlbedoError(error);
    }
  },

  async getAddress() {
    return connectedAddress;
  },

  async getNetwork() {
    return { networkPassphrase: knownNetworkPassphrase };
  },

  async signTransaction(xdr, options) {
    try {
      const albedo = await loadAlbedo();
      const result = await albedo.tx({
        xdr,
        pubkey: options.address,
        network: networkName(options.networkPassphrase),
        submit: false,
        description: "Callora vault transaction",
      });
      const signedNetwork = passphraseForAlbedoNetwork(result.network);
      if (
        signedNetwork &&
        signedNetwork !== options.networkPassphrase
      ) {
        knownNetworkPassphrase = signedNetwork;
        throw new WalletAdapterError(
          "Albedo is connected to a different Stellar network.",
          "NETWORK_MISMATCH",
        );
      }
      if (!result.signed_envelope_xdr) {
        throw new WalletAdapterError(
          "Albedo returned an empty signed transaction.",
          "ERROR",
        );
      }
      const signedTransaction = new Transaction(
        result.signed_envelope_xdr,
        options.networkPassphrase,
      );
      const originalTransaction = new Transaction(
        xdr,
        options.networkPassphrase,
      );
      const expectedSigner = Keypair.fromPublicKey(options.address);
      const expectedHint = expectedSigner.signatureHint();
      const signedByAddress = signedTransaction.signatures.some(
        ({ hint, signature }) =>
          bytesEqual(hint.toXdrObject(), expectedHint) &&
          expectedSigner.verify(
            signedTransaction.hash(),
            signature.toXdrObject(),
          ),
      );
      if (
        signedTransaction.source !== options.address ||
        !bytesEqual(signedTransaction.hash(), originalTransaction.hash()) ||
        !signedByAddress
      ) {
        throw new WalletAdapterError(
          "Albedo did not sign the requested transaction with the connected account.",
          "ERROR",
        );
      }
      knownNetworkPassphrase = signedNetwork ?? options.networkPassphrase;
      return {
        signedTxXdr: result.signed_envelope_xdr,
        signerAddress: options.address,
      };
    } catch (error) {
      if (error instanceof WalletAdapterError) throw error;
      throw mapAlbedoError(error);
    }
  },

  async signMessage(message, options) {
    try {
      const albedo = await loadAlbedo();
      const result = await albedo.signMessage({
        message,
        pubkey: options.address,
      });
      if (!result.message_signature || result.pubkey !== options.address) {
        throw new WalletAdapterError(
          "Albedo did not sign the message with the connected account.",
          "ERROR",
        );
      }
      return result.message_signature;
    } catch (error) {
      if (error instanceof WalletAdapterError) throw error;
      throw mapAlbedoError(error);
    }
  },
};

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function mapAlbedoError(error: unknown): WalletAdapterError {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error || "Albedo could not complete the request.");
  if (isUserRejectedWalletError(error)) {
    return new WalletAdapterError(message, "USER_REJECTED");
  }
  return new WalletAdapterError(message, "ERROR");
}

export function resetAlbedoState(): void {
  connectedAddress = null;
  knownNetworkPassphrase = null;
}
