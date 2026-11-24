import { useSyncExternalStore } from "react";
import {
  getSelectedWallet,
  subscribeSelectedWallet,
} from "../services/wallets";
import {
  getConfig,
  networkPassphraseFor,
  subscribeConfig,
} from "../config/runtimeConfig";

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
let activeWatcher: (() => void) | null = null;
let watcherCallback: (() => void) | null = null;
let unsubscribeWalletSelection: (() => void) | null = null;
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
      networkPassphrase !== networkPassphraseFor(getConfig().network),
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
    const adapter = getSelectedWallet();
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      setState({ ...emptyState, status: "unavailable" });
      return;
    }

    const address = await adapter.getAddress();
    if (!address) {
      setState({ ...emptyState, status: "disconnected" });
      return;
    }

    const network = await adapter.getNetwork();
    setWallet(address, network.networkPassphrase);
  },

  startWatching() {
    const stopWatcher = () => {
      activeWatcher?.();
      activeWatcher = null;
    };
    const watchSelectedWallet = () => {
      stopWatcher();
      const adapter = getSelectedWallet();
      if (!adapter.watch) return;
      activeWatcher = adapter.watch((wallet) => {
        if (wallet.error) {
          const message = apiErrorMessage(wallet.error);
          if (message !== lastWatcherError) {
            lastWatcherError = message;
            console.error(`${adapter.name} wallet watcher failed`, wallet.error);
          }
          return;
        }

        lastWatcherError = "";
        setWallet(wallet.address, wallet.networkPassphrase);
      });
    };
    if (!watcherCallback) {
      watcherCallback = () => watchSelectedWallet();
      unsubscribeWalletSelection = subscribeSelectedWallet(watcherCallback);
    }
    watchSelectedWallet();

    return () => {
      stopWatcher();
      if (watcherCallback) {
        unsubscribeWalletSelection?.();
        unsubscribeWalletSelection = null;
        watcherCallback = null;
      }
    };
  },
};

subscribeSelectedWallet(() => {
  setState(emptyState);
  void walletStore.refresh().catch((error: unknown) => {
    console.error("Could not read wallet status", error);
  });
});

subscribeConfig(() => {
  if (state.address) setWallet(state.address, state.networkPassphrase);
});

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
  const config = getConfig();
  return networkPassphrase === networkPassphraseFor(config.network)
    ? config.network.charAt(0).toUpperCase() + config.network.slice(1)
    : "Unknown network";
}
