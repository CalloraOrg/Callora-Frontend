import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  isAllowed: vi.fn(),
  isConnected: vi.fn(),
  onChange: null as null | ((wallet: {
    address: string;
    networkPassphrase: string;
    error?: Error;
  }) => void),
  requestAccess: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  getAddress: mocks.getAddress,
  getNetworkDetails: mocks.getNetworkDetails,
  isAllowed: mocks.isAllowed,
  isConnected: mocks.isConnected,
  requestAccess: mocks.requestAccess,
  WatchWalletChanges: class {
    watch(callback: (wallet: {
      address: string;
      networkPassphrase: string;
      error?: Error;
    }) => void) {
      mocks.onChange = callback;
      return {};
    }

    stop() {
      mocks.stop();
    }
  },
}));

import WalletStatus from "./WalletStatus";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const alternateAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF";

describe("WalletStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConnected.mockResolvedValue({ isConnected: true });
    mocks.isAllowed.mockResolvedValue({ isAllowed: false });
    mocks.getAddress.mockResolvedValue({ address });
    mocks.getNetworkDetails.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    mocks.requestAccess.mockResolvedValue({ address });
  });

  afterEach(cleanup);

  it("does not prompt on mount, connects only after an explicit click, and tears down the watcher", async () => {
    const { unmount } = render(<WalletStatus />);

    expect(await screen.findByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(mocks.requestAccess).not.toHaveBeenCalled();

    mocks.isAllowed.mockResolvedValue({ isAllowed: true });
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(await screen.findByRole("button", {
      name: `Copy Freighter address ${address}`,
    })).toBeInTheDocument();
    expect(mocks.requestAccess).toHaveBeenCalledOnce();

    unmount();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it("shows and announces account changes and explains a network mismatch", async () => {
    mocks.isAllowed.mockResolvedValue({ isAllowed: true });
    mocks.getNetworkDetails.mockResolvedValue({
      network: "PUBLIC",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    render(<WalletStatus />);

    expect(await screen.findByText("Freighter is on Mainnet, app uses Testnet")).toBeInTheDocument();
    await waitFor(() => expect(mocks.onChange).not.toBeNull());
    act(() => {
      mocks.onChange?.({
        address: alternateAddress,
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      });
    });

    expect(await screen.findByRole("button", {
      name: `Copy Freighter address ${alternateAddress}`,
    })).toBeInTheDocument();
    expect(screen.getByText(`Freighter account changed to ${alternateAddress.slice(0, 5)}…${alternateAddress.slice(-4)}.`)).toBeInTheDocument();
  });

  it("links to Freighter when the extension is unavailable", async () => {
    mocks.isConnected.mockResolvedValue({ isConnected: false });

    render(<WalletStatus />);

    const install = await screen.findByRole("link", { name: "Install Freighter wallet" });
    expect(install).toHaveAttribute("href", "https://www.freighter.app/");
  });
});
