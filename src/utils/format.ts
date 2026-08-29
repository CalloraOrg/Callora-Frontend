/**
 * Shared currency / number formatters.
 *
 * Every component that needs to display USDC amounts or API prices should
 * import from this module rather than defining its own inline helper.
 */

/** Format a number as USDC with exactly 2 decimal places (no $ prefix). */
export function formatUsdc(value: number): string {
  return new Intl.NumberFormat("en-US", {
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
  return `$${new Intl.NumberFormat("en-US", {
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

/**
 * Format milliseconds as a human-readable countdown string.
 *
 * Examples:
 *   0 → "0s"
 *   5000 → "5s"
 *   63000 → "1m 3s"
 *   3661000 → "1h 1m 1s"
 *
 * @param ms - Milliseconds remaining
 * @returns Formatted countdown string (e.g., "1m 23s")
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}
