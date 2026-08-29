/**
 * Shared currency, number, and time formatters.
 *
 * Every component that needs to display USDC amounts, API prices, durations,
 * or timestamps should import from this module rather than defining its own
 * inline helper. All formatters accept an optional `locale` argument that
 * defaults to the browser's current language (`navigator.language`) falling
 * back to `'en-US'` in server/test environments where `navigator` is absent.
 */

/** Resolve the locale to use for formatting. */
function resolveLocale(locale?: string): string {
  if (locale) return locale;
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}

// ── Monetary formatters ───────────────────────────────────────────────────────

/**
 * Format a number as USDC with exactly 2 decimal places (no $ prefix).
 *
 * @example formatUsdc(1234.5)        // "1,234.50"  (en-US)
 * @example formatUsdc(1234.5, 'de')  // "1.234,50"  (de)
 */
export function formatUsdc(value: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as a dollar-prefixed shortcut string.
 *
 * Values ≥ 100 are shown with no decimals; smaller values keep up to 2.
 *
 * @example formatUsdShortcut(9.99)    // "$9.99"
 * @example formatUsdShortcut(1234.5)  // "$1,235"
 */
export function formatUsdShortcut(value: number, locale?: string): string {
  return `$${new Intl.NumberFormat(resolveLocale(locale), {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)}`;
}

/**
 * Format a number to exactly 3 decimal places using locale-aware grouping.
 *
 * Used for per-request API pricing and micro-cost displays.
 *
 * @example formatPrice(0.001)      // "0.001"
 * @example formatPrice(1234.5)     // "1,234.500"  (en-US)
 */
export function formatPrice(value: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * Format a monetary value as a locale-aware estimated cost string with a
 * `$` prefix and 2 decimal places.
 *
 * Used for in-context cost estimations such as "estimated monthly total".
 *
 * @example formatEstimatedCost(0.0045)   // "$0.00"
 * @example formatEstimatedCost(42.3)     // "$42.30"
 */
export function formatEstimatedCost(value: number, locale?: string): string {
  return `$${new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

/**
 * Format a USDC amount with adaptive decimal places:
 * - Values < 0.01 USDC use 3 decimal places for precision.
 * - All other values use 2 decimal places.
 *
 * Used in billing tables where both large and micro-cost amounts appear.
 *
 * @example formatUsdcAmount(0.001)   // "0.001"
 * @example formatUsdcAmount(100)     // "100.00"
 */
export function formatUsdcAmount(value: number, locale?: string): string {
  const decimals = value !== 0 && Math.abs(value) < 0.01 ? 3 : 2;
  return new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format an integer count with locale-aware thousand separators.
 *
 * @example formatCount(1234567)      // "1,234,567"  (en-US)
 * @example formatCount(1234567, 'de') // "1.234.567"  (de)
 */
export function formatCount(value: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Duration / time formatters ────────────────────────────────────────────────

/**
 * Format a duration in milliseconds as a human-readable string.
 *
 * - Values < 1 000 ms → `"123 ms"`
 * - Values ≥ 1 000 ms → `"1.2 s"` (one decimal place)
 *
 * The numeric portion is formatted with the provided locale so thousand
 * separators (for very long durations like `12,345 ms`) render correctly.
 *
 * @example formatDuration(250)         // "250 ms"
 * @example formatDuration(1500)        // "1.5 s"
 * @example formatDuration(12345, 'de') // "12.345 ms"
 */
export function formatDuration(ms: number, locale?: string): string {
  const loc = resolveLocale(locale);
  if (ms < 1000) {
    return `${new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(ms)} ms`;
  }
  return `${new Intl.NumberFormat(loc, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ms / 1000)} s`;
}

/**
 * Format a latency value in milliseconds for display in stat cards / charts.
 *
 * Always shows the raw integer value followed by " ms", using locale-aware
 * thousand separators for large values.
 *
 * @example formatLatencyMs(120)         // "120 ms"
 * @example formatLatencyMs(12345, 'de') // "12.345 ms"
 */
export function formatLatencyMs(ms: number, locale?: string): string {
  return `${new Intl.NumberFormat(resolveLocale(locale), {
    maximumFractionDigits: 0,
  }).format(ms)} ms`;
}

/**
 * Format a `Date` object as a short human-readable timestamp.
 *
 * Output: abbreviated month name, day, 2-digit hour, and minute.
 *
 * @example formatTimestamp(new Date(), 'en-US') // "Jul 25, 2:30 PM"
 * @example formatTimestamp(new Date(), 'de')    // "25. Jul, 14:30"
 */
export function formatTimestamp(date: Date, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(resolveLocale(locale), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Format an ISO 8601 timestamp string as a short date + time.
 *
 * Accepts the same options as `formatTimestamp` but takes a raw ISO string
 * as input (as returned by billing APIs and JSON payloads).
 *
 * @example formatDateShort('2026-07-25T14:32:00Z', 'en-US') // "Jul 25, 2:32 PM"
 */
export function formatDateShort(iso: string, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(resolveLocale(locale), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Format a `Date` object as a locale-aware time string suitable for
 * "last active" displays.
 *
 * @example formatTimeString(new Date(), 'en-US') // "2:30 PM"
 */
export function formatTimeString(date: Date, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(resolveLocale(locale), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Format milliseconds as a human-readable countdown string.
 *
 * Examples:
 *   0 → '0s'
 *   5000 → '5s'
 *   63000 → '1m 3s'
 *   3661000 → '1h 1m 1s'
 *
 * @param ms - Milliseconds remaining
 * @returns Formatted countdown string (e.g., '1m 23s')
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}
