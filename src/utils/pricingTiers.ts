/**
 * Pricing plan catalogue + cost model for the ApiDetailPage pricing tab.
 *
 * Before issue #1091 the page could only *display* plans; nothing told a
 * visitor which one was cheapest for the request volume they had projected.
 * These helpers make that decision explicit, pure, and testable:
 *
 *   monthlyCostUsd(plan, requests, pricePerRequest)
 *   cheapestPlan(requests, pricePerRequest)
 *
 * The plan shapes (flat monthly fee + included volume + discounted overage)
 * mirror the marketing plan cards and the PlanBadge rate limits. The
 * per-request component is always derived from the API's own
 * `pricePerRequest`, so a recommendation never invents a price for the API
 * being viewed — only the platform's flat fees and included volumes are fixed.
 */

export type PricingPlanId = 'free' | 'pro' | 'enterprise';

export type PricingPlan = {
  id: PricingPlanId;
  /** Flat monthly fee in USD. */
  monthlyBaseUsd: number;
  /** Requests covered by `monthlyBaseUsd` each month. */
  includedRequests: number;
  /**
   * Cost per request beyond `includedRequests`, expressed as a multiple of the
   * API's list price (1 = list price, 0.5 = 50 % volume discount).
   */
  overageRateMultiplier: number;
  /**
   * When true the plan is unavailable once `includedRequests` is exceeded
   * (cost becomes `Infinity`), matching a hard-capped free tier.
   */
  capped: boolean;
};

/** Ordered cheapest-eligible-first so ties resolve to the lower tier. */
export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    monthlyBaseUsd: 0,
    includedRequests: 10_000,
    overageRateMultiplier: 0,
    capped: true,
  },
  {
    id: 'pro',
    monthlyBaseUsd: 49,
    includedRequests: 500_000,
    overageRateMultiplier: 1,
    capped: false,
  },
  {
    id: 'enterprise',
    monthlyBaseUsd: 499,
    includedRequests: 5_000_000,
    overageRateMultiplier: 0.5,
    capped: false,
  },
];

/** Coerce a possibly-invalid slider value into a non-negative volume. */
function normaliseRequests(requests: number): number {
  return Number.isFinite(requests) && requests > 0 ? requests : 0;
}

/**
 * Projected monthly cost of `plan` for the given request volume.
 *
 * Returns `Infinity` for a capped plan that cannot serve the volume, which
 * makes it naturally lose the {@link cheapestPlan} comparison.
 */
export function monthlyCostUsd(
  plan: PricingPlan,
  requests: number,
  pricePerRequest: number,
): number {
  const volume = normaliseRequests(requests);

  if (plan.capped && volume > plan.includedRequests) {
    return Number.POSITIVE_INFINITY;
  }

  const overage = Math.max(0, volume - plan.includedRequests);
  const listPrice = Number.isFinite(pricePerRequest) && pricePerRequest > 0 ? pricePerRequest : 0;

  return plan.monthlyBaseUsd + overage * listPrice * plan.overageRateMultiplier;
}

/**
 * The cheapest plan for a projected request volume.
 *
 * Ties keep the earliest entry in `plans` (the lowest tier), so a free plan
 * with a $0 cost always wins over a paid plan that happens to match it.
 * Returns `null` only when `plans` is empty or every plan is unavailable.
 */
export function cheapestPlan(
  requests: number,
  pricePerRequest: number,
  plans: readonly PricingPlan[] = PRICING_PLANS,
): PricingPlan | null {
  let best: PricingPlan | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const plan of plans) {
    const cost = monthlyCostUsd(plan, requests, pricePerRequest);
    if (cost < bestCost) {
      bestCost = cost;
      best = plan;
    }
  }

  return best;
}
