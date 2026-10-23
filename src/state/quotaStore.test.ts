import { QuotaStore } from "./quotaStore";
import { makeFakeApi, linkedChannels, tick } from "./quotaTestUtils";

function record(accountId: string, value: number, version: number) {
  return { accountId, value, version, updatedAt: version };
}

describe("QuotaStore — race safety", () => {
  it("never lets a stale/out-of-order response overwrite a newer state", async () => {
    const fake = makeFakeApi();
    const store = new QuotaStore({ api: fake.api, tabId: "t1" });

    const loadPromise = store.selectAccount("a"); // fetchCalls[0] (gen 1)
    const refreshPromise = store.refresh(); // fetchCalls[1] (gen 2)

    // Resolve the NEWER generation first.
    fake.resolveFetch(1, record("a", 200, 2));
    await refreshPromise;

    expect(store.getSlice("a").value).toBe(200);
    expect(store.getSlice("a").version).toBe(2);

    // Now the OLDER response arrives late — it must be dropped.
    fake.resolveFetch(0, record("a", 100, 1));
    await tick();

    expect(store.getSlice("a").value).toBe(200);
    expect(store.getSlice("a").version).toBe(2);
    await loadPromise;
  });

  it("abandons in-flight requests when switching accounts", async () => {
    const fake = makeFakeApi();
    const store = new QuotaStore({ api: fake.api, tabId: "t1" });

    const aPromise = store.selectAccount("a"); // fetchCalls[0] for 'a'
    // Switch before 'a' resolves; this should abort 'a's in-flight fetch.
    const bPromise = store.selectAccount("b"); // fetchCalls[1] for 'b'
    fake.resolveFetch(1, record("b", 50, 1));
    await bPromise;
    fake.resolveFetch(0, record("a", 100, 1)); // already aborted; harmless
    await aPromise;

    expect(store.getSnapshot().currentAccountId).toBe("b");
    expect(store.getSlice("b").value).toBe(50);
    // 'a' was never loaded because its request was abandoned.
    expect(store.getSlice("a").value).toBeNull();
  });

  it("keeps other accounts cached and isolated after a switch", async () => {
    const fake = makeFakeApi();
    const store = new QuotaStore({ api: fake.api, tabId: "t1" });

    const aPromise = store.selectAccount("a");
    fake.resolveFetch(0, record("a", 100, 1));
    await aPromise;

    const bPromise = store.selectAccount("b");
    fake.resolveFetch(1, record("b", 50, 1));
    await bPromise;

    expect(store.getSnapshot().currentAccountId).toBe("b");
    expect(store.getSlice("a").value).toBe(100); // untouched cache
    expect(store.getSlice("b").value).toBe(50);
  });
});

describe("QuotaStore — unconfirmed mutations are never reported as success", () => {
  it("shows submitting state and leaves authoritative value unchanged until confirmation", async () => {
    const fake = makeFakeApi({ a: 100 });
    const store = new QuotaStore({ api: fake.api, tabId: "t1" });

    const loadP = store.selectAccount("a");
    fake.resolveFetch(0, record("a", 100, 1));
    await loadP;

    const updateP = store.update(150); // updateCalls[0]
    // Synchronously after dispatch, the value is still authoritative.
    expect(store.getSlice("a").pendingStatus).toBe("submitting");
    expect(store.getSlice("a").value).toBe(100); // NOT 150
    expect(store.getSlice("a").pendingValue).toBe(150);

    fake.resolveUpdate(0, record("a", 150, 2));
    await updateP;

    expect(store.getSlice("a").pendingStatus).toBe("idle");
    expect(store.getSlice("a").value).toBe(150);
    expect(store.getSlice("a").pendingValue).toBeNull();
  });

  it("surfaces an error and allows retry on a network failure", async () => {
    const fake = makeFakeApi({ a: 100 });
    const store = new QuotaStore({ api: fake.api, tabId: "t1" });

    const loadP = store.selectAccount("a");
    fake.resolveFetch(0, record("a", 100, 1));
    await loadP;

    const updateP = store.update(150); // updateCalls[0]
    fake.rejectUpdate(0, new Error("Network down"));
    await updateP;

    expect(store.getSlice("a").pendingStatus).toBe("error");
    expect(store.getSlice("a").pendingError).toMatch(/Network down/i);
    expect(store.getSlice("a").value).toBe(100); // reverted, not applied

    // Retry -> re-submit (version is known, so no extra fetch needed).
    const retryP = store.retry(); // updateCalls[1]
    fake.resolveUpdate(1, record("a", 150, 2));
    await retryP;

    expect(store.getSlice("a").pendingStatus).toBe("idle");
    expect(store.getSlice("a").value).toBe(150);
    expect(store.getSlice("a").retryCount).toBeGreaterThan(0);
  });
});

describe("QuotaStore — conflict handling", () => {
  it("detects a version conflict and reconciles to server state", async () => {
    const fake = makeFakeApi({ a: 100 });
    // Two stores share the SAME server (api) but do NOT cross-tab sync here.
    const tab1 = new QuotaStore({ api: fake.api, tabId: "tab1" });
    const tab2 = new QuotaStore({ api: fake.api, tabId: "tab2" });

    const l1 = tab1.selectAccount("a");
    fake.resolveFetch(0, record("a", 100, 1));
    await l1;

    const l2 = tab2.selectAccount("a");
    fake.resolveFetch(1, record("a", 100, 1));
    await l2;

    // tab1 commits 200 -> server becomes v2.
    const u1 = tab1.update(200); // updateCalls[0]
    fake.resolveUpdate(0, record("a", 200, 2));
    await u1;

    // tab2 submits 300 based on its stale v1 -> conflict.
    const u2 = tab2.update(300); // updateCalls[1], base 1
    fake.rejectLastUpdateConflict(2, "a");
    await tick(); // let the catch run and start the reconcile fetch
    fake.resolveFetch(2, record("a", 200, 2)); // fetchCalls[2]
    await u2;

    expect(tab2.getSlice("a").pendingStatus).toBe("error");
    expect(tab2.getSlice("a").pendingError).toMatch(/Conflict/i);
    expect(tab2.getSlice("a").value).toBe(200);
    expect(tab2.getSlice("a").loadStatus).toBe("stale");
  });
});

describe("QuotaStore — cross-tab synchronization", () => {
  it("instantly applies a mutation made in another tab", async () => {
    const fake = makeFakeApi({ a: 100 });
    const [ch1, ch2] = linkedChannels();
    const tab1 = new QuotaStore({ api: fake.api, channel: ch1, tabId: "tab1" });
    const tab2 = new QuotaStore({ api: fake.api, channel: ch2, tabId: "tab2" });

    const l1 = tab1.selectAccount("a");
    fake.resolveFetch(0, record("a", 100, 1));
    await l1;

    const l2 = tab2.selectAccount("a");
    fake.resolveFetch(1, record("a", 100, 1));
    await l2;

    // tab1 updates -> broadcasts -> tab2 reflects it WITHOUT its own fetch.
    const u1 = tab1.update(200); // updateCalls[0]
    fake.resolveUpdate(0, record("a", 200, 2));
    await u1;
    await tick();

    expect(tab2.getSlice("a").value).toBe(200);
    expect(tab2.getSlice("a").version).toBe(2);
  });

  it("supersedes a local pending mutation when another tab updates first", async () => {
    const fake = makeFakeApi({ a: 100 });
    const [ch1, ch2] = linkedChannels();
    const tab1 = new QuotaStore({ api: fake.api, channel: ch1, tabId: "tab1" });
    const tab2 = new QuotaStore({ api: fake.api, channel: ch2, tabId: "tab2" });

    const l1 = tab1.selectAccount("a");
    fake.resolveFetch(0, record("a", 100, 1));
    await l1;

    const l2 = tab2.selectAccount("a");
    fake.resolveFetch(1, record("a", 100, 1));
    await l2;

    // tab2 starts a submit (kept in-flight) ...
    const pending = tab2.update(999); // updateCalls[0], base 1, not resolved

    // ... meanwhile tab1 commits 200 and broadcasts to tab2.
    const u1 = tab1.update(200); // updateCalls[1]
    fake.resolveUpdate(1, record("a", 200, 2));
    await u1;
    await tick();

    expect(tab2.getSlice("a").pendingStatus).toBe("error");
    expect(tab2.getSlice("a").value).toBe(200); // authoritative from tab1
    expect(tab2.getSlice("a").loadStatus).toBe("stale");

    // Resolve the now-superseded request so it can settle (no effect).
    fake.resolveUpdate(0, record("a", 999, 3));
    await pending;
  });
});
