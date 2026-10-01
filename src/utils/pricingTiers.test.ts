import { describe, it, expect } from 'vitest';
import {
  PRICING_PLANS,
  cheapestPlan,
  monthlyCostUsd,
  type PricingPlan,
} from './pricingTiers';

const FREE = PRICING_PLANS.find((p) => p.id === 'free')!;
const PRO = PRICING_PLANS.find((p) => p.id === 'pro')!;
const ENTERPRISE = PRICING_PLANS.find((p) => p.id === 'enterprise')!;

// A representative list price for the API being viewed.
const PRICE = 0.01;

describe('monthlyCostUsd', () => {
  it('charges nothing while the volume is inside the included allowance', () => {
    expect(monthlyCostUsd(PRO, 10_000, PRICE)).toBe(49);
    expect(monthlyCostUsd(ENTERPRISE, 1_000_000, PRICE)).toBe(499);
  });

  it('charges the flat fee plus overage at the plan multiplier', () => {
    // 500,000 included; 100,000 extra at the list price.
    expect(monthlyCostUsd(PRO, 600_000, PRICE)).toBeCloseTo(49 + 100_000 * PRICE, 6);
    // Enterprise pays 50 % of the list price beyond 5M requests.
    expect(monthlyCostUsd(ENTERPRISE, 6_000_000, PRICE)).toBeCloseTo(499 + 1_000_000 * PRICE * 0.5, 6);
  });

  it('makes a hard-capped plan unavailable beyond its allowance', () => {
    expect(monthlyCostUsd(FREE, 10_000, PRICE)).toBe(0);
    expect(monthlyCostUsd(FREE, 10_001, PRICE)).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats invalid volumes and prices as zero rather than producing NaN', () => {
    expect(monthlyCostUsd(PRO, Number.NaN, PRICE)).toBe(49);
    expect(monthlyCostUsd(PRO, -5, Number.NaN)).toBe(49);
  });
});

describe('cheapestPlan', () => {
  it('recommends the free tier for small volumes', () => {
    expect(cheapestPlan(1_000, PRICE)?.id).toBe('free');
    expect(cheapestPlan(10_000, PRICE)?.id).toBe('free');
  });

  it('recommends the pro tier once the free allowance is exceeded', () => {
    expect(cheapestPlan(20_000, PRICE)?.id).toBe('pro');
    expect(cheapestPlan(500_000, PRICE)?.id).toBe('pro');
  });

  it('recommends the enterprise tier at high volumes', () => {
    expect(cheapestPlan(600_000, PRICE)?.id).toBe('enterprise');
    expect(cheapestPlan(1_000_000, PRICE)?.id).toBe('enterprise');
  });

  it('changes the recommendation as volume grows (slider behaviour)', () => {
    const ids = [1_000, 20_000, 1_000_000].map((n) => cheapestPlan(n, PRICE)?.id);
    expect(ids).toEqual(['free', 'pro', 'enterprise']);
  });

  it('breaks ties in favour of the earliest (lowest) plan', () => {
    const plans: PricingPlan[] = [
      { id: 'free', monthlyBaseUsd: 0, includedRequests: 0, overageRateMultiplier: 1, capped: false },
      { id: 'pro', monthlyBaseUsd: 0, includedRequests: 0, overageRateMultiplier: 1, capped: false },
    ];
    expect(cheapestPlan(1_000, PRICE, plans)?.id).toBe('free');
  });

  it('returns null when nothing is available', () => {
    const plans: PricingPlan[] = [
      { id: 'free', monthlyBaseUsd: 0, includedRequests: 0, overageRateMultiplier: 0, capped: true },
    ];
    // The only plan is hard-capped at 0 requests → Infinity → no winner.
    expect(cheapestPlan(1_000, PRICE, plans)).toBeNull();
    expect(cheapestPlan(1_000, PRICE, [])).toBeNull();
  });
});
