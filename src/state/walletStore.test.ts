import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  isAllowed: vi.fn(),
  isConnected: vi.fn(),
  onChange: vi.fn(),
  stop: vi.fn(),
  watch: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  getAddress: mocks.getAddress,
  getNetworkDetails: mocks.getNetworkDetails,
  isAllowed: mocks.isAllowed,
  isConnected: mocks.isConnected,
  WatchWalletChanges: class {
    watch(callback: (wallet: {
      address: string;
      networkPassphrase: string;
      error?: Error;
    }) => void) {
      mocks.onChange.mockImplementation(callback);
      mocks.watch();
      return {};
    }

    stop() {
      mocks.stop();
    }
  },
}));

import { walletStore } from "./walletStore";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const mainnetPassphrase = "Public Global Stellar Network ; September 2015";

describe("walletStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.isAllowed.mockResolvedValue({ isAllowed: true });
    mocks.getAddress.mockResolvedValue({ address });
    mocks.getNetworkDetails.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("silently reports unavailable and disconnected wallet states", async () => {
    mocks.isConnected.mockResolvedValueOnce({ isConnected: false });
    await walletStore.refresh();
    expect(walletStore.getSnapshot()).toMatchObject({
      status: "unavailable",
      address: null,
    });

    mocks.isAllowed.mockResolvedValueOnce({ isAllowed: false });
    await walletStore.refresh();
    expect(walletStore.getSnapshot()).toMatchObject({
      status: "disconnected",
      address: null,
    });
  });

  it("publishes the connected address and identifies a network mismatch", async () => {
    mocks.getNetworkDetails.mockResolvedValueOnce({
      network: "PUBLIC",
      networkPassphrase: mainnetPassphrase,
    });

    await walletStore.refresh();

    expect(walletStore.getSnapshot()).toMatchObject({
      status: "connected",
      address,
      networkPassphrase: mainnetPassphrase,
      isNetworkMismatch: true,
    });
  });

  it("updates from wallet changes and stops its watcher", async () => {
    const stopWatching = walletStore.startWatching();
    const changedAddress = `${address.slice(0, -1)}G`;

    mocks.onChange({
      address: changedAddress,
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    expect(walletStore.getSnapshot()).toMatchObject({
      status: "connected",
      address: changedAddress,
      isNetworkMismatch: false,
    });

    stopWatching();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
});
