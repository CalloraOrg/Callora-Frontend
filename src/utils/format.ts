/**
 * Shared currency / number formatters.
 *
 * Every component that needs to display USDC amounts or API prices should
 * import from this module rather than defining its own inline helper.
 */

/** Format a number as USDC with exactly 2 decimal places (no $ prefix). */
export function formatUsdc(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as a dollar-prefixed shortcut string.
 *
 * Values ≥ 100 are shown with no decimals; smaller values keep up to 2.
 */
export function formatUsdShortcut(value: number): string {
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)}`;
}

/**
 * Format a number to exactly 3 decimal places (no $ prefix).
 *
 * Used for per-request API pricing and micro-cost displays.
 */
export function formatPrice(value: number): string {
  return value.toFixed(3);
}
