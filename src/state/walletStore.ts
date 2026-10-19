import { useSyncExternalStore } from "react";
import {
  WatchWalletChanges,
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
} from "@stellar/freighter-api";
import {
  STELLAR_NETWORK,
  STELLAR_NETWORK_PASSPHRASE,
} from "../config/constants";

export type WalletState = {
  status: "unavailable" | "disconnected" | "connected";
  address: string | null;
  networkPassphrase: string | null;
  isNetworkMismatch: boolean;
};

const emptyState: WalletState = {
  status: "unavailable",
  address: null,
  networkPassphrase: null,
  isNetworkMismatch: false,
};

const listeners = new Set<() => void>();
let state = emptyState;
let activeWatcher: WatchWalletChanges | null = null;
let lastWatcherError = "";

function emitChange() {
  for (const listener of listeners) listener();
}

function setState(nextState: WalletState) {
  if (
    state.status === nextState.status &&
    state.address === nextState.address &&
    state.networkPassphrase === nextState.networkPassphrase &&
    state.isNetworkMismatch === nextState.isNetworkMismatch
  ) {
    return;
  }
  state = nextState;
  emitChange();
}

function setWallet(address: string | null, networkPassphrase: string | null) {
  const connected = Boolean(address);
  setState({
    status: connected ? "connected" : "disconnected",
    address: connected ? address : null,
    networkPassphrase,
    isNetworkMismatch:
      connected &&
      Boolean(networkPassphrase) &&
      networkPassphrase !== STELLAR_NETWORK_PASSPHRASE,
  });
}

function apiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

export const walletStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot() {
    return state;
  },

  async refresh() {
    const connection = await isConnected();
    if (connection.error) throw connection.error;
    if (!connection.isConnected) {
      setState(emptyState);
      return;
    }

    const permission = await isAllowed();
    if (permission.error) throw permission.error;
    if (!permission.isAllowed) {
      setState({ ...emptyState, status: "disconnected" });
      return;
    }

    const [account, network] = await Promise.all([
      getAddress(),
      getNetworkDetails(),
    ]);
    if (account.error) throw account.error;
    if (network.error) throw network.error;
    setWallet(account.address || null, network.networkPassphrase || null);
  },

  startWatching() {
    if (activeWatcher) return () => {};

    const watcher = new WatchWalletChanges();
    activeWatcher = watcher;
    const result = watcher.watch((wallet) => {
      if (wallet.error) {
        const message = apiErrorMessage(wallet.error);
        if (message !== lastWatcherError) {
          lastWatcherError = message;
          console.error("Freighter wallet watcher failed", wallet.error);
        }
        return;
      }

      lastWatcherError = "";
      setWallet(wallet.address || null, wallet.networkPassphrase || null);
    });

    if (result.error) {
      console.error("Could not start Freighter wallet watcher", result.error);
    }

    return () => {
      watcher.stop();
      if (activeWatcher === watcher) activeWatcher = null;
    };
  },
};

export function useWalletStore() {
  return useSyncExternalStore(
    walletStore.subscribe,
    walletStore.getSnapshot,
    walletStore.getSnapshot,
  );
}

export function getWalletNetworkLabel(networkPassphrase: string | null): string {
  if (!networkPassphrase) return "Unknown network";
  if (networkPassphrase === "Public Global Stellar Network ; September 2015") {
    return "Mainnet";
  }
  if (networkPassphrase === "Test SDF Network ; September 2015") {
    return "Testnet";
  }
  if (networkPassphrase === "Test SDF Future Network ; October 2022") {
    return "Futurenet";
  }
  return networkPassphrase === STELLAR_NETWORK_PASSPHRASE
    ? STELLAR_NETWORK[0].toUpperCase() + STELLAR_NETWORK.slice(1)
    : "Unknown network";
}
