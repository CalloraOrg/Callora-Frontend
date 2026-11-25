import { albedoAdapter, resetAlbedoState } from "./AlbedoAdapter";
import { freighterAdapter, resetFreighterState } from "./FreighterAdapter";
import type { WalletAdapter } from "./WalletAdapter";

export const DEFAULT_WALLET_ID = freighterAdapter.id;
export const WALLET_SELECTION_STORAGE_KEY = "callora-selected-wallet";

export const walletAdapters: readonly WalletAdapter[] = [
  freighterAdapter,
  albedoAdapter,
];

const walletAdaptersById = new Map(
  walletAdapters.map((adapter) => [adapter.id, adapter]),
);
const listeners = new Set<() => void>();

function readStoredWalletId(): string {
  if (typeof localStorage === "undefined") return DEFAULT_WALLET_ID;
  try {
    const stored = localStorage.getItem(WALLET_SELECTION_STORAGE_KEY);
    return stored && walletAdaptersById.has(stored)
      ? stored
      : DEFAULT_WALLET_ID;
  } catch {
    return DEFAULT_WALLET_ID;
  }
}

let selectedWalletId = readStoredWalletId();

export function getSelectedWalletId(): string {
  return selectedWalletId;
}

export function getSelectedWallet(): WalletAdapter {
  return walletAdaptersById.get(selectedWalletId) ?? freighterAdapter;
}

export function getWalletAdapter(id: string): WalletAdapter | undefined {
  return walletAdaptersById.get(id);
}

export function subscribeSelectedWallet(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function selectWallet(id: string): void {
  if (!walletAdaptersById.has(id) || id === selectedWalletId) return;
  selectedWalletId = id;
  try {
    localStorage.setItem(WALLET_SELECTION_STORAGE_KEY, id);
  } catch {
    // Keep the in-memory selection when storage is unavailable.
  }
  for (const listener of listeners) listener();
}

export function clearSelectedWallet(): void {
  selectedWalletId = DEFAULT_WALLET_ID;
  resetAlbedoState();
  resetFreighterState();
  try {
    localStorage.removeItem(WALLET_SELECTION_STORAGE_KEY);
  } catch {
    // Keep the default in-memory selection when storage is unavailable.
  }
  for (const listener of listeners) listener();
}
