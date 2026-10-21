import { useEffect, useRef, useState } from "react";
import { Check, Copy, Wallet } from "lucide-react";
import { requestAccess } from "@stellar/freighter-api";
import { STELLAR_NETWORK } from "../config/constants";
import {
  getWalletNetworkLabel,
  useWalletStore,
  walletStore,
} from "../state/walletStore";

const APP_NETWORK_LABEL =
  STELLAR_NETWORK[0].toUpperCase() + STELLAR_NETWORK.slice(1);

const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

function compactAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export default function WalletStatus() {
  const wallet = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const previousAddress = useRef<string | null>(null);

  useEffect(() => {
    void walletStore.refresh().catch((error: unknown) => {
      console.error("Could not read Freighter wallet status", error);
    });
    return walletStore.startWatching();
  }, []);

  useEffect(() => {
    if (previousAddress.current && wallet.address && previousAddress.current !== wallet.address) {
      setAnnouncement(`Freighter account changed to ${compactAddress(wallet.address)}.`);
    } else if (previousAddress.current && !wallet.address) {
      setAnnouncement("Freighter account disconnected.");
    }
    previousAddress.current = wallet.address;
  }, [wallet.address]);

  const connect = async () => {
    setIsConnecting(true);
    setMessage("");
    try {
      const result = await requestAccess();
      if (result.error) throw result.error;
      if (!result.address) {
        throw new Error("Freighter did not provide an account address.");
      }
      await walletStore.refresh();
      setAnnouncement(`Freighter connected to ${compactAddress(result.address)}.`);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Could not connect to Freighter. Check the wallet and try again.";
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
      ? `Copy connected Freighter address ${wallet.address}`
      : wallet.status === "disconnected"
        ? "Connect wallet"
        : "Install Freighter";

  return (
    <div className="wallet-status" role="group" aria-label="Freighter wallet status">
      {wallet.status === "unavailable" ? (
        <a
          className="wallet-status-control"
          href={FREIGHTER_INSTALL_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Install Freighter wallet"
        >
          <Wallet aria-hidden="true" size={16} />
          <span className="wallet-status-label">Install Freighter</span>
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
            aria-label={`Copy Freighter address ${wallet.address}`}
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

      {wallet.isNetworkMismatch && (
        <span className="wallet-network-warning" role="status">
          Freighter is on {networkLabel}, app uses {APP_NETWORK_LABEL}
        </span>
      )}
      {message && <span className="wallet-status-message" role="status">{message}</span>}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
