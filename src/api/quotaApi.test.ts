import { createQuotaApi, QuotaConflictError } from "../api/quotaApi";

describe("createQuotaApi", () => {
  it("returns a default record for an unknown account", async () => {
    const api = createQuotaApi();
    const rec = await api.fetchQuota("unknown");
    expect(rec.value).toBe(0);
    expect(rec.version).toBe(1);
    expect(typeof rec.updatedAt).toBe("number");
  });

  it("seeds initial values", async () => {
    const api = createQuotaApi({ initial: { a: 10 } });
    const rec = await api.fetchQuota("a");
    expect(rec.value).toBe(10);
    expect(rec.version).toBe(1);
  });

  it("bumps the version on a successful update and persists it", async () => {
    const api = createQuotaApi({ initial: { a: 10 } });
    const before = await api.fetchQuota("a");
    const after = await api.updateQuota("a", 20, before.version);
    expect(after.value).toBe(20);
    expect(after.version).toBe(2);

    const refetched = await api.fetchQuota("a");
    expect(refetched.value).toBe(20);
    expect(refetched.version).toBe(2);
  });

  it("rejects an update based on a stale version with QuotaConflictError", async () => {
    const api = createQuotaApi({ initial: { a: 10 } });
    const v1 = await api.fetchQuota("a");
    await api.updateQuota("a", 20, v1.version); // -> v2

    await expect(api.updateQuota("a", 30, v1.version)).rejects.toBeInstanceOf(
      QuotaConflictError,
    );
  });

  it("rejects an aborted fetch with an AbortError", async () => {
    const api = createQuotaApi({ latencyMs: 50 });
    const controller = new AbortController();
    const promise = api.fetchQuota("a", controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
