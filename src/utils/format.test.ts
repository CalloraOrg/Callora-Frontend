import { describe, it, expect } from 'vitest';
import { formatUsdc, formatUsdShortcut, formatPrice } from './format';

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
});

// ---------------------------------------------------------------------------
// formatPrice – 3-decimal plain number (no $ prefix)
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
    expect(formatPrice(0.0055)).toBe('0.005');
  });

  it('formats a whole number', () => {
    expect(formatPrice(5)).toBe('5.000');
  });

  it('formats a value >= 100', () => {
    expect(formatPrice(123.456)).toBe('123.456');
  });

  it('handles negative values', () => {
    expect(formatPrice(-0.005)).toBe('-0.005');
  });

  it('returns a string (not prefixed with $)', () => {
    const result = formatPrice(1.5);
    expect(result).not.toContain('$');
    expect(result).toBe('1.500');
  });
});

// ---------------------------------------------------------------------------
// formatCountdown – Human-readable countdown timer formatter
// ---------------------------------------------------------------------------
import { formatCountdown } from './format';

describe('formatCountdown', () => {
  it('formats 0ms as '0s'', () => {
    expect(formatCountdown(0)).toBe('0s');
  });

  it('formats negative values as '0s'', () => {
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
