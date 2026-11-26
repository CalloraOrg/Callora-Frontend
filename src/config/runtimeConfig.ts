import { useSyncExternalStore } from "react";
import { isValidContractId, isValidEd25519PublicKey } from "../utils/stellarAddress";
import {
  API_BASE,
  DEFAULT_STELLAR_NETWORK,
  STELLAR_NETWORK,
  STELLAR_RPC_URL,
  STELLAR_USDC_ASSET,
  STELLAR_USDC_CONFIGURATION_ERROR,
  STELLAR_VAULT_CONFIG,
  STELLAR_VAULT_CONTRACT_ID,
  type StellarNetwork,
} from "./constants";

export type RuntimeConfig = {
  network: StellarNetwork;
  rpcUrl: string;
  vaultContractId: string;
  usdcIssuer?: string;
  enableDemoOutcome: boolean;
};

type RuntimeConfigState = {
  config: RuntimeConfig;
  usedFallback: boolean;
};

const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  mainnet: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
};

const HORIZON_URLS: Record<StellarNetwork, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
};

export const RUNTIME_CONFIG_TIMEOUT_MS = 3_000;

const BUILD_TIME_CONFIG: RuntimeConfig = {
  network: STELLAR_NETWORK || DEFAULT_STELLAR_NETWORK,
  rpcUrl: STELLAR_RPC_URL,
  vaultContractId: STELLAR_VAULT_CONTRACT_ID,
  usdcIssuer: STELLAR_USDC_ASSET.issuer,
  enableDemoOutcome: import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_OUTCOME === "true",
};

let state: RuntimeConfigState = {
  config: BUILD_TIME_CONFIG,
  usedFallback: false,
};

const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

export function getConfig(): RuntimeConfig {
  return state.config;
}

export function subscribeConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRuntimeConfig(): RuntimeConfig {
  return useSyncExternalStore(subscribeConfig, getConfig, getConfig);
}

export function useRuntimeConfigStatus(): RuntimeConfigState {
  return useSyncExternalStore(subscribeConfig, () => state, () => state);
}

export function setRuntimeConfig(config: RuntimeConfig): void {
  state = { config, usedFallback: false };
  emitChange();
}

export function markRuntimeConfigFallback(): void {
  if (state.usedFallback) return;
  state = { ...state, usedFallback: true };
  emitChange();
}

export function networkPassphraseFor(network: StellarNetwork): string {
  return NETWORK_PASSPHRASES[network];
}

export function horizonUrlFor(network: StellarNetwork): string {
  return HORIZON_URLS[network];
}

export function usdcConfigurationError(config: RuntimeConfig = getConfig()): string | null {
  if (
    config.usdcIssuer === STELLAR_USDC_ASSET.issuer &&
    STELLAR_USDC_CONFIGURATION_ERROR
  ) {
    return STELLAR_USDC_CONFIGURATION_ERROR;
  }
  if (!config.usdcIssuer || !isValidEd25519PublicKey(config.usdcIssuer)) {
    return "Configure a valid Stellar Ed25519 public key for the USDC issuer on this network.";
  }
  return null;
}

const ALLOWED_FIELDS = new Set([
  "network",
  "rpcUrl",
  "vaultContractId",
  "usdcIssuer",
  "enableDemoOutcome",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** Validate a partial API response and merge it over the immutable build-time fallback. */
export function validateRuntimeConfig(
  payload: unknown,
  fallback: RuntimeConfig = BUILD_TIME_CONFIG,
): RuntimeConfig {
  if (!isRecord(payload)) throw new Error("Runtime config must be an object.");
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_FIELDS.has(key)) throw new Error("Runtime config contains an unsupported field.");
  }

  const result: RuntimeConfig = { ...fallback };
  if (hasOwn(payload, "network")) {
    if (
      typeof payload.network !== "string" ||
      !["testnet", "mainnet", "futurenet"].includes(payload.network)
    ) {
      throw new Error("Runtime config network is invalid.");
    }
    result.network = payload.network as StellarNetwork;
  }

  if (hasOwn(payload, "rpcUrl")) {
    if (typeof payload.rpcUrl !== "string") {
      throw new Error("Runtime config RPC URL is invalid.");
    }
    let url: URL;
    try {
      url = new URL(payload.rpcUrl);
    } catch {
      throw new Error("Runtime config RPC URL is invalid.");
    }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new Error("Runtime config RPC URL must use HTTPS.");
    }
    result.rpcUrl = url.toString().replace(/\/+$/, "");
  }

  if (hasOwn(payload, "vaultContractId")) {
    if (
      typeof payload.vaultContractId !== "string" ||
      !isValidContractId(payload.vaultContractId)
    ) {
      throw new Error("Runtime config vault contract ID is invalid.");
    }
    result.vaultContractId = payload.vaultContractId;
  }

  if (hasOwn(payload, "usdcIssuer")) {
    if (
      typeof payload.usdcIssuer !== "string" ||
      !isValidEd25519PublicKey(payload.usdcIssuer)
    ) {
      throw new Error("Runtime config USDC issuer is invalid.");
    }
    result.usdcIssuer = payload.usdcIssuer;
  }

  if (hasOwn(payload, "enableDemoOutcome")) {
    if (typeof payload.enableDemoOutcome !== "boolean") {
      throw new Error("Runtime config demo-outcome flag is invalid.");
    }
    result.enableDemoOutcome = payload.enableDemoOutcome;
  }

  if (
    result.network === "mainnet" &&
    !hasOwn(payload, "vaultContractId") &&
    !(fallback.network === "mainnet" && STELLAR_VAULT_CONFIG.source === "env")
  ) {
    throw new Error("Mainnet requires an explicit vault contract ID.");
  }
  if (result.network !== fallback.network) {
    if (!hasOwn(payload, "rpcUrl")) {
      throw new Error("Changing networks requires an explicit RPC URL.");
    }
    if (!hasOwn(payload, "usdcIssuer")) {
      throw new Error("Changing networks requires an explicit USDC issuer.");
    }
  }

  return result;
}

export async function loadRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    RUNTIME_CONFIG_TIMEOUT_MS,
  );
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });

  try {
    const base = API_BASE;
    const response = await fetch(`${base}/api/config`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Runtime config request failed.");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Runtime config response was not valid JSON.");
    }
    return validateRuntimeConfig(payload);
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function getHorizonUrl(config: RuntimeConfig = getConfig()): string {
  return horizonUrlFor(config.network);
}
