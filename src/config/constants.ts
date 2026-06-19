/**
 * Shared application constants.
 *
 * Centralises config-like values that were previously scattered as inline
 * literals across multiple components, making them easier to maintain and
 * keeping a single source of truth.
 */

/** Stellar block-explorer base URL used to build transaction links. */
export const EXPLORER_BASE_URL =
  "https://stellar.expert/explorer/testnet/tx/";

/** Public Callora API base URL used in code examples and requests. */
export const API_BASE_URL = "https://api.callora.com";

/** Minimum USDC deposit amount accepted by the vault. */
export const MIN_DEPOSIT = 10;

/** Human-readable network fee shown in the deposit preview. */
export const NETWORK_FEE = "0.00001 XLM";

/** Quick-select deposit amounts offered in the billing modal. */
export const PRESET_AMOUNTS = [10, 50, 100, 500] as const;

/**
 * Simulated loading delay (ms) used by MarketplacePage, ApiDetailPage,
 * and Dashboard to mimic an async data fetch.
 */
export const LOADING_DELAY_MS = 1500;
