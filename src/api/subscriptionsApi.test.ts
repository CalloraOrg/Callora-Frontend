import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "../services/authFetch";
import { cancelSubscription, changePlan, listSubscriptions } from "./subscriptionsApi";

vi.mock("../services/authFetch", () => ({ authFetch: vi.fn() }));
const mockFetch = vi.mocked(authFetch);
const item = { id: "sub-1", apiName: "Weather", planId: "pro", status: "active", renewalDate: "2026-12-01T00:00:00.000Z", monthlyRequests: 1000, pricePerRequest: 0.001 };
const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body } as Response);

describe("subscriptionsApi", () => {
  beforeEach(() => mockFetch.mockReset());
  it("lists and validates subscription plans", async () => {
    mockFetch.mockResolvedValue(response({ subscriptions: [item] }));
    expect(await listSubscriptions()).toEqual([item]);
    mockFetch.mockResolvedValue(response({ subscriptions: [{ ...item, planId: "gold" }] }));
    await expect(listSubscriptions()).rejects.toThrow("response was invalid");
  });
  it("changes plan with a validated plan ID", async () => {
    mockFetch.mockResolvedValue(response({ ...item, planId: "free" }));
    expect((await changePlan("sub/1", "free")).planId).toBe("free");
    expect(mockFetch).toHaveBeenCalledWith("/api/subscriptions/sub%2F1", expect.objectContaining({ method: "PATCH", body: '{"planId":"free"}' }));
    await expect(changePlan("sub-1", "gold" as never)).rejects.toThrow("valid plan");
  });
  it("cancels and reports failed responses", async () => {
    mockFetch.mockResolvedValue(response({ ...item, status: "cancelling" }));
    expect((await cancelSubscription("sub-1")).status).toBe("cancelling");
    mockFetch.mockResolvedValue(response({}, false, 500));
    await expect(cancelSubscription("sub-1")).rejects.toThrow("500");
  });
});
