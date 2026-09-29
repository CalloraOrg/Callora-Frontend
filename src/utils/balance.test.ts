import { describe, expect, it } from "vitest";
import { formatBalance, UNKNOWN_BALANCE_LABEL } from "./balance";

describe("formatBalance", () => {
  it("formats a known balance as USDC with two decimals", () => {
    expect(formatBalance(284.62)).toBe("284.62 USDC");
    expect(formatBalance(0)).toBe("0.00 USDC");
    expect(formatBalance(1234.5)).toBe("1,234.50 USDC");
  });

  it("never renders an unknown balance as zero", () => {
    expect(formatBalance(null)).toBe(UNKNOWN_BALANCE_LABEL);
    expect(formatBalance(undefined)).toBe(UNKNOWN_BALANCE_LABEL);
    expect(formatBalance(Number.NaN)).toBe(UNKNOWN_BALANCE_LABEL);
    expect(formatBalance(Number.POSITIVE_INFINITY)).toBe(UNKNOWN_BALANCE_LABEL);
  });

  it("does not imply a 0.00 balance for unknown values", () => {
    expect(formatBalance(null)).not.toContain("0.00");
  });
});
