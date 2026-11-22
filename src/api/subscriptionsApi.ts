import { authFetch } from "../services/authFetch";
import { PRICING_PLANS, type PricingPlanId } from "../utils/pricingTiers";

export type SubscriptionStatus = "active" | "cancelling" | "ended";

export interface Subscription {
  id: string;
  apiName: string;
  planId: PricingPlanId;
  status: SubscriptionStatus;
  renewalDate: string | null;
  monthlyRequests: number;
  pricePerRequest: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlanId(value: unknown): value is PricingPlanId {
  return PRICING_PLANS.some((plan) => plan.id === value);
}

function parseSubscription(value: unknown): Subscription {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.apiName !== "string" ||
      !isPlanId(value.planId) || !["active", "cancelling", "ended"].includes(String(value.status)) ||
      !(typeof value.renewalDate === "string" || value.renewalDate === null) ||
      typeof value.monthlyRequests !== "number" || !Number.isFinite(value.monthlyRequests) ||
      typeof value.pricePerRequest !== "number" || !Number.isFinite(value.pricePerRequest)) {
    throw new Error("The subscriptions response was invalid.");
  }
  return value as unknown as Subscription;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authFetch(path, init);
  if (!response.ok) throw new Error(`Subscription request failed (${response.status}).`);
  if (response.status === 204) return null;
  return response.json();
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const data = await request("/api/subscriptions");
  const rows = Array.isArray(data) ? data : isRecord(data) ? data.subscriptions : null;
  if (!Array.isArray(rows)) throw new Error("The subscriptions response was invalid.");
  return rows.map(parseSubscription);
}

export async function changePlan(id: string, planId: PricingPlanId): Promise<Subscription> {
  if (!isPlanId(planId)) throw new Error("Choose a valid plan.");
  return parseSubscription(await request(`/api/subscriptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId }),
  }));
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  return parseSubscription(await request(`/api/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  }));
}
