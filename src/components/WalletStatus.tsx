import { useEffect, useRef, useState } from "react";
import { Check, Copy, Wallet } from "lucide-react";
import { useRuntimeConfig } from "../config/runtimeConfig";
import {
  getSelectedWallet,
  selectWallet,
  walletAdapters,
} from "../services/wallets";
import {
  getWalletNetworkLabel,
  useWalletStore,
  walletStore,
} from "../state/walletStore";

function compactAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export default function WalletStatus() {
  const wallet = useWalletStore();
  const config = useRuntimeConfig();
  const appNetworkLabel = config.network.charAt(0).toUpperCase() + config.network.slice(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const previousAddress = useRef<string | null>(null);
  const selectedWallet = getSelectedWallet();

  useEffect(() => {
    void walletStore.refresh().catch((error: unknown) => {
      console.error("Could not read wallet status", error);
    });
    void Promise.all(
      walletAdapters.map(async (adapter) => [
        adapter.id,
        await adapter.isAvailable(),
      ] as const),
    ).then((results) => setAvailability(Object.fromEntries(results)));
    return walletStore.startWatching();
  }, []);

  useEffect(() => {
    if (previousAddress.current && wallet.address && previousAddress.current !== wallet.address) {
      setAnnouncement(`${selectedWallet.name} account changed to ${compactAddress(wallet.address)}.`);
    } else if (previousAddress.current && !wallet.address) {
      setAnnouncement(`${selectedWallet.name} account disconnected.`);
    }
    previousAddress.current = wallet.address;
  }, [wallet.address, selectedWallet.name]);

  const connect = async () => {
    setIsConnecting(true);
    setMessage("");
    try {
      const result = await selectedWallet.connect();
      if (!result.address) {
        throw new Error(`${selectedWallet.name} did not provide an account address.`);
      }
      await walletStore.refresh();
      setAnnouncement(`${selectedWallet.name} connected to ${compactAddress(result.address)}.`);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : `Could not connect to ${selectedWallet.name}. Check the wallet and try again.`;
      setMessage(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const copyAddress = async () => {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setMessage("Wallet address copied.");
    } catch {
      setMessage("Could not copy the wallet address.");
    }
  };

  const networkLabel = getWalletNetworkLabel(wallet.networkPassphrase);
  const controlLabel =
    wallet.status === "connected"
      ? `Copy connected ${selectedWallet.name} address ${wallet.address}`
      : wallet.status === "disconnected"
        ? "Connect wallet"
        : `Install ${selectedWallet.name}`;

  return (
    <div className="wallet-status" role="group" aria-label={`${selectedWallet.name} wallet status`}>
      <label className="sr-only" htmlFor="wallet-adapter-picker">Select wallet</label>
      <select
        id="wallet-adapter-picker"
        aria-label="Select wallet"
        value={selectedWallet.id}
        onChange={(event) => {
          selectWallet(event.target.value);
          setMessage("");
          void walletStore.refresh().catch((error: unknown) => {
            console.error("Could not read wallet status", error);
          });
        }}
      >
        {walletAdapters.map((adapter) => (
          <option
            key={adapter.id}
            value={adapter.id}
            disabled={availability[adapter.id] === false}
          >
            {adapter.name}{adapter.id === selectedWallet.id ? " (selected)" : ""}
            {availability[adapter.id] === false ? " (unavailable)" : ""}
          </option>
        ))}
      </select>
      {wallet.status === "unavailable" ? (
        <a
          className="wallet-status-control"
          href={selectedWallet.installUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Install ${selectedWallet.name} wallet`}
        >
          <Wallet aria-hidden="true" size={16} />
          <span className="wallet-status-label">Install {selectedWallet.name}</span>
        </a>
      ) : wallet.status === "disconnected" ? (
        <button
          type="button"
          className="wallet-status-control"
          onClick={connect}
          disabled={isConnecting}
          aria-label={controlLabel}
        >
          <Wallet aria-hidden="true" size={16} />
          <span className="wallet-status-label">
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </span>
        </button>
      ) : (
        <>
          <button
            type="button"
            className="wallet-status-control wallet-status-copy"
            onClick={copyAddress}
            aria-label={`Copy ${selectedWallet.name} address ${wallet.address}`}
            title={wallet.address ?? undefined}
          >
            <Wallet aria-hidden="true" size={16} />
            <span className="wallet-status-label">
              {compactAddress(wallet.address ?? "")}
            </span>
            <span className="wallet-copy-icon" aria-hidden="true">
              {message === "Wallet address copied." ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
            </span>
          </button>
          <span className="wallet-network-chip">{networkLabel}</span>
        </>
      )}
      <div className="wallet-install-links" aria-label="Wallet installation links">
        {walletAdapters
          .filter((adapter) => availability[adapter.id] === false)
          .map((adapter) => (
            <a key={adapter.id} href={adapter.installUrl} target="_blank" rel="noreferrer">
              Get {adapter.name}
            </a>
          ))}
      </div>

      {wallet.isNetworkMismatch && (
        <span className="wallet-network-warning" role="status">
          {selectedWallet.name} is on {networkLabel}, app uses {appNetworkLabel}
        </span>
      )}
      {message && <span className="wallet-status-message" role="status">{message}</span>}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
