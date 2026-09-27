/**
 * Shared application constants.
 *
 * Centralises config-like values that were previously scattered as inline
 * literals across multiple components, making them easier to maintain and
 * keeping a single source of truth.
 *
 * Environment-backed values are read here and nowhere else - see
 * `docs/Configuration.md` and `.env.example` for the full list of supported
 * `VITE_*` variables and their defaults.
 */

/** Stellar block-explorer base URL used to build transaction links. */
export const EXPLORER_BASE_URL =
  "https://stellar.expert/explorer/testnet/tx/";

/** Public Callora API base URL used in code examples and requests. */
export const API_BASE_URL = "https://api.callora.com";

/** Minimum USDC deposit amount accepted by the vault. */
export const MIN_DEPOSIT = 10;

/** Low balance warning threshold in USDC. */
export const LOW_BALANCE_USD = 15;

/** Human-readable network fee shown in the deposit preview. */
export const NETWORK_FEE = "0.00001 XLM";

/** Quick-select deposit amounts offered in the billing modal. */
export const PRESET_AMOUNTS = [10, 50, 100, 500] as const;

/**
 * Simulated loading delay (ms) used by MarketplacePage, ApiDetailPage,
 * and Dashboard to mimic an async data fetch.
 */
export const LOADING_DELAY_MS = 1500;

/**
 * Stellar networks the app can be pointed at.
 *
 * `VITE_STELLAR_NETWORK` is validated against this list so a typo cannot
 * silently produce an app that looks configured but talks to the wrong chain.
 */
export type StellarNetwork = "testnet" | "mainnet" | "futurenet";

/** Network used when `VITE_STELLAR_NETWORK` is unset or unrecognised. */
export const DEFAULT_STELLAR_NETWORK: StellarNetwork = "testnet";

const STELLAR_NETWORKS: readonly StellarNetwork[] = [
  "testnet",
  "mainnet",
  "futurenet",
];

/**
 * Runtime environment supplied by Vite.
 *
 * Declared locally rather than relying on `vite/client` ambient types so this
 * module stays the single, self-contained entry point for configuration.
 */
type RuntimeEnv = Record<string, string | boolean | undefined> & {
  DEV?: boolean;
};

const runtimeEnv: RuntimeEnv =
  (import.meta as { env?: RuntimeEnv }).env ?? {};

/** Trim whitespace and any trailing slashes from a configured origin. */
export function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

/**
 * Coerce a raw `VITE_STELLAR_NETWORK` value into a known network.
 *
 * Unset or empty values fall back silently; anything else that is not a known
 * network falls back with a development-only warning, because a bad value
 * almost always means a typo in `.env` rather than an intentional override.
 */
export function resolveStellarNetwork(raw: string | undefined): StellarNetwork {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") {
    return DEFAULT_STELLAR_NETWORK;
  }
  if ((STELLAR_NETWORKS as readonly string[]).includes(value)) {
    return value as StellarNetwork;
  }
  if (runtimeEnv.DEV) {
    console.warn(
      `[config] Unknown VITE_STELLAR_NETWORK "${raw}"; falling back to "${DEFAULT_STELLAR_NETWORK}".`,
    );
  }
  return DEFAULT_STELLAR_NETWORK;
}

/**
 * Base path prepended to Callora API request paths.
 *
 * Empty in local development, where the Vite dev server proxies `/api` to the
 * backend (see `vite.config.ts`), so callers can always use relative paths.
 * Set `VITE_API_BASE_URL` to an absolute origin to call a remote backend.
 */
export const API_BASE = normalizeBaseUrl(
  runtimeEnv.VITE_API_BASE_URL as string | undefined,
);

/** Stellar network the UI is currently pointed at. */
export const STELLAR_NETWORK: StellarNetwork = resolveStellarNetwork(
  runtimeEnv.VITE_STELLAR_NETWORK as string | undefined,
);

/**
 * Build a request path against the configured API base.
 *
 * With no `VITE_API_BASE_URL` this returns the relative path unchanged, which
 * is what the dev proxy expects; with one it produces an absolute URL.
 */
export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}
