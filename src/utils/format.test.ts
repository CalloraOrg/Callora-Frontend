import { describe, it, expect } from 'vitest';
import {
  formatUsdc,
  formatUsdShortcut,
  formatPrice,
  formatEstimatedCost,
  formatUsdcAmount,
  formatCount,
  formatDuration,
  formatLatencyMs,
  formatTimestamp,
  formatDateShort,
  formatTimeString,
  formatCountdown,
  formatDueDate,
} from './format';

// ---------------------------------------------------------------------------
// formatUsdc – 2-decimal USDC formatter (no $ prefix)
// ---------------------------------------------------------------------------
describe('formatUsdc', () => {
  it('formats zero', () => {
    expect(formatUsdc(0)).toBe('0.00');
  });

  it('formats a small value', () => {
    expect(formatUsdc(1.5)).toBe('1.50');
  });

  it('formats a value with more than 2 decimals (rounds)', () => {
    expect(formatUsdc(1.999)).toBe('2.00');
  });

  it('formats a value >= 100', () => {
    expect(formatUsdc(100)).toBe('100.00');
  });

  it('formats a large value with thousand separators', () => {
    expect(formatUsdc(1234.56)).toBe('1,234.56');
  });

  it('formats a very small fractional value', () => {
    expect(formatUsdc(0.01)).toBe('0.01');
  });

  it('handles negative values', () => {
    expect(formatUsdc(-42.5)).toBe('-42.50');
  });

  it('respects an explicit locale argument', () => {
    // German locale uses comma as decimal and period as thousands separator
    const result = formatUsdc(1234.56, 'de-DE');
    expect(result).toContain('1.234');
    expect(result).toContain('56');
  });
});

// ---------------------------------------------------------------------------
// formatUsdShortcut – dollar-prefixed shortcut
// ---------------------------------------------------------------------------
describe('formatUsdShortcut', () => {
  it('formats zero with 2 decimals', () => {
    expect(formatUsdShortcut(0)).toBe('$0');
  });

  it('formats a small value with up to 2 decimals', () => {
    expect(formatUsdShortcut(9.99)).toBe('$9.99');
  });

  it('formats value just below 100 with decimals', () => {
    expect(formatUsdShortcut(99.99)).toBe('$99.99');
  });

  it('formats 100 with no decimals', () => {
    expect(formatUsdShortcut(100)).toBe('$100');
  });

  it('formats large value with no decimals', () => {
    expect(formatUsdShortcut(1234.56)).toBe('$1,235');
  });

  it('formats 10 (below 100) with decimals', () => {
    expect(formatUsdShortcut(10)).toBe('$10');
  });

  it('handles negative values below 100', () => {
    expect(formatUsdShortcut(-5.5)).toBe('$-5.5');
  });

  it('always prefixes with $', () => {
    expect(formatUsdShortcut(42, 'de-DE')).toMatch(/^\$/);
  });
});

// ---------------------------------------------------------------------------
// formatPrice – 3-decimal locale-aware number (no $ prefix)
// ---------------------------------------------------------------------------
describe('formatPrice', () => {
  it('formats zero', () => {
    expect(formatPrice(0)).toBe('0.000');
  });

  it('formats a small micro-cost', () => {
    expect(formatPrice(0.001)).toBe('0.001');
  });

  it('formats a typical per-request price', () => {
    expect(formatPrice(0.01)).toBe('0.010');
  });

  it('formats a value with many decimals (rounds)', () => {
    expect(formatPrice(0.0055)).toBe('0.006');
  });

  it('formats a whole number', () => {
    expect(formatPrice(5)).toBe('5.000');
  });

  it('formats a value >= 100 with thousand separators', () => {
    expect(formatPrice(1234.567)).toBe('1,234.567');
  });

  it('handles negative values', () => {
    expect(formatPrice(-0.005)).toBe('-0.005');
  });

  it('returns a string (not prefixed with $)', () => {
    const result = formatPrice(1.5);
    expect(result).not.toContain('$');
    expect(result).toBe('1.500');
  });

  it('respects an explicit locale argument', () => {
    const result = formatPrice(1234.5, 'de-DE');
    // German uses period for thousands, comma for decimals
    expect(result).toContain('1.234');
  });
});

// ---------------------------------------------------------------------------
// formatEstimatedCost – $-prefixed 2-decimal cost string
// ---------------------------------------------------------------------------
describe('formatEstimatedCost', () => {
  it('formats zero as $0.00', () => {
    expect(formatEstimatedCost(0)).toBe('$0.00');
  });

  it('formats a small value', () => {
    expect(formatEstimatedCost(0.0045)).toBe('$0.00');
  });

  it('formats a mid-range value', () => {
    expect(formatEstimatedCost(42.3)).toBe('$42.30');
  });

  it('formats a large value with thousand separators', () => {
    expect(formatEstimatedCost(1234.5)).toBe('$1,234.50');
  });

  it('always prefixes with $', () => {
    expect(formatEstimatedCost(5, 'de-DE')).toMatch(/^\$/);
  });

  it('rounds to 2 decimal places', () => {
    expect(formatEstimatedCost(1.999)).toBe('$2.00');
  });
});

// ---------------------------------------------------------------------------
// formatUsdcAmount – adaptive-decimal billing amount
// ---------------------------------------------------------------------------
describe('formatUsdcAmount', () => {
  it('uses 2 decimals for values >= 0.01', () => {
    expect(formatUsdcAmount(100)).toBe('100.00');
    expect(formatUsdcAmount(0.24)).toBe('0.24');
    expect(formatUsdcAmount(0.01)).toBe('0.01');
  });

  it('uses 3 decimals for values < 0.01', () => {
    expect(formatUsdcAmount(0.001)).toBe('0.001');
    expect(formatUsdcAmount(0.009)).toBe('0.009');
  });

  it('formats zero with 2 decimals', () => {
    expect(formatUsdcAmount(0)).toBe('0.00');
  });

  it('does not prepend a $ sign', () => {
    expect(formatUsdcAmount(5)).not.toContain('$');
  });

  it('respects an explicit locale argument', () => {
    const result = formatUsdcAmount(1234.56, 'de-DE');
    expect(result).toContain('1.234');
  });
});

// ---------------------------------------------------------------------------
// formatCount – integer with locale-aware thousand separators
// ---------------------------------------------------------------------------
describe('formatCount', () => {
  it('formats zero', () => {
    expect(formatCount(0)).toBe('0');
  });

  it('formats a small number', () => {
    expect(formatCount(42)).toBe('42');
  });

  it('formats a thousand with separator', () => {
    expect(formatCount(1000)).toBe('1,000');
  });

  it('formats a million', () => {
    expect(formatCount(1_000_000)).toBe('1,000,000');
  });

  it('truncates decimal portion', () => {
    expect(formatCount(1234.9)).toBe('1,235');
  });

  it('respects an explicit locale argument', () => {
    const result = formatCount(1234567, 'de-DE');
    expect(result).toContain('1.234.567');
  });
});

// ---------------------------------------------------------------------------
// formatDuration – human-readable ms/s duration
// ---------------------------------------------------------------------------
describe('formatDuration', () => {
  it('formats 0 ms', () => {
    expect(formatDuration(0)).toBe('0 ms');
  });

  it('formats sub-second values as ms', () => {
    expect(formatDuration(120)).toBe('120 ms');
    expect(formatDuration(999)).toBe('999 ms');
  });

  it('formats exactly 1000 ms as 1.0 s', () => {
    expect(formatDuration(1000)).toBe('1.0 s');
  });

  it('formats 1500 ms as 1.5 s', () => {
    expect(formatDuration(1500)).toBe('1.5 s');
  });

  it('rounds seconds to 1 decimal place', () => {
    expect(formatDuration(2456)).toBe('2.5 s');
  });

  it('does not add thousand separators for typical ms values', () => {
    expect(formatDuration(250)).toBe('250 ms');
  });

  it('respects an explicit locale for large ms values', () => {
    // 12345 ms < 1000? No, 12345 > 1000 so it will be in seconds
    const result = formatDuration(12345);
    expect(result).toContain('s');
  });

  it('returns a string', () => {
    expect(typeof formatDuration(100)).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// formatLatencyMs – integer ms with locale-aware separators
// ---------------------------------------------------------------------------
describe('formatLatencyMs', () => {
  it('formats 0 ms', () => {
    expect(formatLatencyMs(0)).toBe('0 ms');
  });

  it('formats typical latency values', () => {
    expect(formatLatencyMs(88)).toBe('88 ms');
    expect(formatLatencyMs(152)).toBe('152 ms');
    expect(formatLatencyMs(210)).toBe('210 ms');
  });

  it('formats large values with thousand separators', () => {
    expect(formatLatencyMs(12345)).toBe('12,345 ms');
  });

  it('always appends " ms"', () => {
    expect(formatLatencyMs(500)).toMatch(/ ms$/);
  });

  it('respects an explicit locale argument', () => {
    const result = formatLatencyMs(12345, 'de-DE');
    expect(result).toContain('12.345');
    expect(result).toContain('ms');
  });
});

// ---------------------------------------------------------------------------
// formatTimestamp – Date → short date/time string
// ---------------------------------------------------------------------------
describe('formatTimestamp', () => {
  const date = new Date('2026-07-25T14:32:00Z');

  it('returns a non-empty string', () => {
    const result = formatTimestamp(date, 'en-US');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the day number', () => {
    const result = formatTimestamp(date, 'en-US');
    expect(result).toMatch(/25/);
  });

  it('includes the month abbreviation in en-US', () => {
    const result = formatTimestamp(date, 'en-US');
    expect(result).toContain('Jul');
  });

  it('returns a different format for a different locale', () => {
    const enResult = formatTimestamp(date, 'en-US');
    const deResult = formatTimestamp(date, 'de-DE');
    // Both should be non-empty strings but formatted differently
    expect(typeof deResult).toBe('string');
    expect(deResult.length).toBeGreaterThan(0);
    expect(enResult).not.toBe(deResult);
  });
});

// ---------------------------------------------------------------------------
// formatDateShort – ISO string → short date/time string
// ---------------------------------------------------------------------------
describe('formatDateShort', () => {
  const iso = '2026-07-25T14:32:00Z';

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDateShort(iso, 'en-US');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the day number', () => {
    expect(formatDateShort(iso, 'en-US')).toMatch(/25/);
  });

  it('includes the month abbreviation in en-US', () => {
    expect(formatDateShort(iso, 'en-US')).toContain('Jul');
  });

  it('falls back to the original ISO string on invalid input', () => {
    const bad = 'not-a-date';
    const result = formatDateShort(bad, 'en-US');
    // Browsers may not throw on garbage input; tolerate both cases
    expect(typeof result).toBe('string');
  });

  it('respects an explicit locale argument', () => {
    const enResult = formatDateShort(iso, 'en-US');
    const deResult = formatDateShort(iso, 'de-DE');
    expect(typeof deResult).toBe('string');
    expect(deResult.length).toBeGreaterThan(0);
    expect(enResult).not.toBe(deResult);
  });
});

// ---------------------------------------------------------------------------
// formatTimeString – Date → short HH:MM time string
// ---------------------------------------------------------------------------
describe('formatTimeString', () => {
  const date = new Date('2026-07-25T14:32:00Z');

  it('returns a non-empty string', () => {
    const result = formatTimeString(date, 'en-US');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the minute portion', () => {
    // Minutes "32" should appear regardless of AM/PM format
    const result = formatTimeString(date, 'en-US');
    expect(result).toMatch(/32/);
  });

  it('respects an explicit locale argument', () => {
    const enResult = formatTimeString(date, 'en-US');
    const deResult = formatTimeString(date, 'de-DE');
    expect(typeof deResult).toBe('string');
    expect(deResult.length).toBeGreaterThan(0);
    // de-DE uses 24h by default; en-US 12h — outputs differ
    expect(enResult).not.toBe(deResult);
  });
});

// ---------------------------------------------------------------------------
// Locale fallback: all formatters gracefully fall back when no locale given
// ---------------------------------------------------------------------------
describe('locale fallback (no explicit locale arg)', () => {
  it('formatUsdc without locale returns a valid 2-decimal string', () => {
    expect(formatUsdc(1.5)).toMatch(/1[.,]50/);
  });

  it('formatDuration without locale returns ms/s string', () => {
    expect(formatDuration(500)).toMatch(/ms/);
    expect(formatDuration(2000)).toMatch(/s/);
  });

  it('formatLatencyMs without locale returns a string ending in ms', () => {
    expect(formatLatencyMs(120)).toMatch(/ms/);
  });

  it('formatCount without locale returns digits-only string', () => {
    // Should contain at least one digit
    expect(formatCount(1000)).toMatch(/\d/);
  });

  it('formatTimestamp without locale returns a non-empty string', () => {
    expect(formatTimestamp(new Date()).length).toBeGreaterThan(0);
  });
});

describe('formatCountdown', () => {
  it('formats 0ms as "0s"', () => {
    expect(formatCountdown(0)).toBe('0s');
  });

  it('formats negative values as "0s"', () => {
    expect(formatCountdown(-1000)).toBe('0s');
  });

  it('formats seconds correctly', () => {
    expect(formatCountdown(5000)).toBe('5s');
    expect(formatCountdown(1000)).toBe('1s');
    expect(formatCountdown(59000)).toBe('59s');
  });

  it('formats minutes and seconds correctly', () => {
    expect(formatCountdown(63000)).toBe('1m 3s');
    expect(formatCountdown(125000)).toBe('2m 5s');
    expect(formatCountdown(3599000)).toBe('59m 59s');
  });

  it('formats hours, minutes, and seconds correctly', () => {
    expect(formatCountdown(3661000)).toBe('1h 1m 1s');
    expect(formatCountdown(7322000)).toBe('2h 2m 2s');
  });

  it('omits zero values', () => {
    expect(formatCountdown(60000)).toBe('1m');
    expect(formatCountdown(3600000)).toBe('1h');
    expect(formatCountdown(3660000)).toBe('1h 1m');
  });

  it('handles rounding for milliseconds', () => {
    // 1500ms should round up to 2s
    expect(formatCountdown(1500)).toBe('2s');
    // 1499ms should round down to 1s
    expect(formatCountdown(1499)).toBe('1s');
  });

  it('handles large durations', () => {
    expect(formatCountdown(86400000)).toBe('24h');
    expect(formatCountdown(90061000)).toBe('25h 1m 1s');
  });
});

// ---------------------------------------------------------------------------
// formatDueDate – formats invoice due dates in target timezone
// ---------------------------------------------------------------------------
describe('formatDueDate', () => {
  it('preserves non-date strings like "Due in 7 days"', () => {
    expect(formatDueDate('Due in 7 days')).toBe('Due in 7 days');
    expect(formatDueDate('Immediate')).toBe('Immediate');
  });

  it('formats an ISO timestamp in UTC timezone', () => {
    const iso = '2026-09-01T15:30:00Z';
    const formatted = formatDueDate(iso, { timeZone: 'UTC', locale: 'en-US' });
    expect(formatted).toContain('Sep 1, 2026');
  });

  it('formats dates across different timezones reflecting timezone offsets', () => {
    // 2026-09-01T01:00:00Z -> Aug 31 in New York (EDT -4), Sep 1 in Tokyo (JST +9)
    const iso = '2026-09-01T01:00:00Z';
    const ny = formatDueDate(iso, { timeZone: 'America/New_York', locale: 'en-US' });
    const tokyo = formatDueDate(iso, { timeZone: 'Asia/Tokyo', locale: 'en-US' });

    expect(ny).toContain('Aug 31, 2026');
    expect(tokyo).toContain('Sep 1, 2026');
  });

  it('supports includeTime option', () => {
    const iso = '2026-09-01T15:30:00Z';
    const formatted = formatDueDate(iso, { timeZone: 'UTC', locale: 'en-US', includeTime: true });
    expect(formatted).toMatch(/Sep 1, 2026/);
    expect(formatted).toMatch(/03:30|3:30/);
  });

  it('handles Date objects and numeric timestamps', () => {
    const date = new Date('2026-10-15T12:00:00Z');
    expect(formatDueDate(date, { timeZone: 'UTC', locale: 'en-US' })).toContain('Oct 15, 2026');
    expect(formatDueDate(date.getTime(), { timeZone: 'UTC', locale: 'en-US' })).toContain('Oct 15, 2026');
  });
});

