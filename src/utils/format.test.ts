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
