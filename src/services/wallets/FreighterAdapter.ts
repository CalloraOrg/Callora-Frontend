import {
  WatchWalletChanges,
  getNetwork,
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  signMessage,
  signTransaction,
} from "@stellar/freighter-api";
import {
  isUserRejectedWalletError,
  WalletAdapterError,
  type WalletAdapter,
} from "./WalletAdapter";

let connectedAddress: string | null = null;

export const freighterAdapter: WalletAdapter = {
  id: "freighter",
  name: "Freighter",
  installUrl: "https://www.freighter.app/",
  capabilities: { signMessage: true },

  async isAvailable() {
    try {
      const result = await isConnected();
      return result.isConnected;
    } catch {
      return false;
    }
  },

  async connect() {
    try {
      const result = await requestAccess();
      if (result.error) throw result.error;
      if (!result.address) {
        throw new WalletAdapterError(
          "Freighter did not provide an account address.",
          "UNAVAILABLE",
        );
      }
      connectedAddress = result.address;
      return { address: result.address };
    } catch (error) {
      if (error instanceof WalletAdapterError) throw error;
      throw new WalletAdapterError(
        errorMessage(error) || "Freighter could not connect.",
        isUserRejectedWalletError(error) ? "USER_REJECTED" : "ERROR",
      );
    }
  },

  async getAddress() {
    if (connectedAddress) return connectedAddress;
    if (typeof isAllowed !== "function" || typeof getAddress !== "function") {
      return null;
    }
    const permission = await isAllowed();
    if (permission.error) throw permission.error;
    if (!permission.isAllowed) return null;
    const result = await getAddress();
    if (result.error) throw result.error;
    return result.address || null;
  },

  async getNetwork() {
    const readNetwork =
      typeof getNetworkDetails === "function" ? getNetworkDetails : getNetwork;
    const result = await readNetwork();
    if (result.error) throw result.error;
    return { networkPassphrase: result.networkPassphrase || null };
  },

  async signTransaction(xdr, options) {
    try {
      const result = await signTransaction(xdr, options);
      if (result.error) throw result.error;
      return {
        signedTxXdr: result.signedTxXdr,
        signerAddress: result.signerAddress,
      };
    } catch (error) {
      throw new WalletAdapterError(
        errorMessage(error) || "Freighter could not sign the transaction.",
        isUserRejectedWalletError(error) ? "USER_REJECTED" : "ERROR",
      );
    }
  },

  async signMessage(message, options) {
    try {
      const result = await signMessage(message, options);
      if (result.error) throw result.error;
      if (!result.signedMessage) {
        throw new WalletAdapterError(
          "Freighter returned an empty signature.",
          "ERROR",
        );
      }
      return typeof result.signedMessage === "string"
        ? result.signedMessage
        : result.signedMessage.toString("hex");
    } catch (error) {
      if (error instanceof WalletAdapterError) throw error;
      throw new WalletAdapterError(
        errorMessage(error) || "Freighter could not sign the message.",
        isUserRejectedWalletError(error) ? "USER_REJECTED" : "ERROR",
      );
    }
  },

  watch(callback) {
    const watcher = new WatchWalletChanges();
    const result = watcher.watch((wallet) => {
      callback({
        address: wallet.address || null,
        networkPassphrase: wallet.networkPassphrase || null,
        ...(wallet.error instanceof Error ? { error: wallet.error } : {}),
      });
      connectedAddress = wallet.address || null;
    });
    if (result.error) {
      console.error("Could not start Freighter wallet watcher", result.error);
    }
    return () => watcher.stop();
  },
};

export function resetFreighterState(): void {
  connectedAddress = null;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "";
}
