import { formatUsdc } from "./format";

/**
 * Balance display helpers.
 *
 * A balance can be genuinely unknown — the request is still in flight or it
 * failed — and unknown must never be rendered as `0.00 USDC`, because a zero
 * balance trips the low-balance banner and would tell a funded account that it
 * is broke.
 */

/** Shown wherever a balance is unknown (loading, failed, or not provided). */
export const UNKNOWN_BALANCE_LABEL = "Unavailable";

/**
 * Format a USDC balance for display.
 *
 * @param value - Balance in USDC, or `null` when unknown.
 * @returns `"284.62 USDC"` for a known balance, {@link UNKNOWN_BALANCE_LABEL}
 *          otherwise. Non-finite values are treated as unknown.
 */
export function formatBalance(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNKNOWN_BALANCE_LABEL;
  }
  return `${formatUsdc(value)} USDC`;
}
