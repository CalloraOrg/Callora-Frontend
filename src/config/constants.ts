/**
 * Shared application constants.
 *
 * Centralises config-like values that were previously scattered as inline
 * literals across multiple components, making them easier to maintain and
 * keeping a single source of truth.
 */

/** Stellar block-explorer base URL used to build transaction links. */
export const STELLAR_NETWORK =
  import.meta.env.VITE_STELLAR_NETWORK?.toLowerCase() === "mainnet"
    ? "PUBLIC"
    : "TESTNET";

export const STELLAR_NETWORK_PASSPHRASE =
  STELLAR_NETWORK === "PUBLIC"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

export const STELLAR_RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL?.trim() ||
  (STELLAR_NETWORK === "TESTNET"
    ? "https://soroban-testnet.stellar.org"
    : "");

export const STELLAR_VAULT_CONTRACT_ID =
  import.meta.env.VITE_STELLAR_VAULT_CONTRACT_ID?.trim() || "";

export const STELLAR_USDC_DECIMALS = 7;

export const ENABLE_DEMO_OUTCOME =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_DEMO_OUTCOME === "true";

/** Stellar block-explorer base URL used to build transaction links. */
export const EXPLORER_BASE_URL =
  STELLAR_NETWORK === "PUBLIC"
    ? "https://stellar.expert/explorer/public/tx/"
    : "https://stellar.expert/explorer/testnet/tx/";

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

/** External links used in the footer and across the app. */
export const EXTERNAL_LINKS = {
  about: "https://callora.org/about",
  support: "https://callora.org/support",
  terms: "https://callora.org/terms",
  privacy: "https://callora.org/privacy",
} as const;
