// @vitest-environment jsdom

/**
 * invoiceStore.test.ts
 *
 * Tests for the invoiceStore external store.
 * Covers: status transitions, version-based optimistic concurrency,
 *         filter/sort/pagination, pending action tracking, stale detection,
 *         and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoiceStore } from "../state/invoiceStore";
import type { Invoice, InvoiceStatus } from "../types/invoice";
import { canTransition, VALID_TRANSITIONS } from "../types/invoice";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: `inv-${Math.random().toString(36).slice(2, 8)}`,
    number: `INV-${Date.now()}`,
    status: "draft",
    version: 1,
    amount: 100,
    currency: "USDC",
    createdAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    apiName: "Test API",
    items: [],
    ...overrides,
  };
}

function injectInvoices(invoices: Invoice[]) {
  invoiceStore.setInvoices(invoices);
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  invoiceStore._reset();
  vi.useFakeTimers();
});

afterEach(() => {
  invoiceStore._reset();
  vi.useRealTimers();
});

// ─── Valid transition table ──────────────────────────────────────────────────

describe("VALID_TRANSITIONS", () => {
  it("draft can transition to pending and cancelled", () => {
    expect(canTransition("draft", "pending")).toBe(true);
    expect(canTransition("draft", "cancelled")).toBe(true);
    expect(canTransition("draft", "paid")).toBe(false);
    expect(canTransition("draft", "overdue")).toBe(false);
  });

  it("pending can transition to paid, cancelled, and overdue", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("pending", "overdue")).toBe(true);
    expect(canTransition("pending", "draft")).toBe(false);
  });

  it("paid is a terminal state (no transitions)", () => {
    expect(VALID_TRANSITIONS.paid).toHaveLength(0);
    expect(canTransition("paid", "pending")).toBe(false);
    expect(canTransition("paid", "cancelled")).toBe(false);
  });

  it("overdue can transition to paid and cancelled", () => {
    expect(canTransition("overdue", "paid")).toBe(true);
    expect(canTransition("overdue", "cancelled")).toBe(true);
    expect(canTransition("overdue", "draft")).toBe(false);
  });

  it("cancelled is a terminal state (no transitions)", () => {
    expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
    expect(canTransition("cancelled", "pending")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
  });
});

// ─── Store basics ────────────────────────────────────────────────────────────

describe("invoiceStore", () => {
  it("starts with empty state", () => {
    const snapshot = invoiceStore.getSnapshot();
    expect(snapshot.invoices.size).toBe(0);
    expect(snapshot.isLoading).toBe(false);
    expect(snapshot.error).toBeNull();
    expect(snapshot.pendingActions.size).toBe(0);
  });

  it("setInvoices populates the store", () => {
    const inv1 = makeInvoice({ id: "inv-1", version: 1 });
    const inv2 = makeInvoice({ id: "inv-2", version: 1 });
    injectInvoices([inv1, inv2]);

    const snapshot = invoiceStore.getSnapshot();
    expect(snapshot.invoices.size).toBe(2);
    expect(snapshot.lastFetchedAt).not.toBeNull();
  });

  it("setInvoices reconciles newer versions", () => {
    const inv = makeInvoice({ id: "inv-1", version: 1 });
    injectInvoices([inv]);

    const updated = { ...inv, version: 2, status: "pending" as InvoiceStatus };
    injectInvoices([updated]);

    const snapshot = invoiceStore.getSnapshot();
    expect(snapshot.invoices.get("inv-1")?.version).toBe(2);
    expect(snapshot.invoices.get("inv-1")?.status).toBe("pending");
  });

  it("setInvoices does NOT overwrite with older version", () => {
    const inv = makeInvoice({ id: "inv-1", version: 3 });
    injectInvoices([inv]);

    const older = { ...inv, version: 2, status: "draft" as InvoiceStatus };
    injectInvoices([older]);

    const snapshot = invoiceStore.getSnapshot();
    expect(snapshot.invoices.get("inv-1")?.version).toBe(3);
  });

  it("setLoading updates isLoading", () => {
    invoiceStore.setLoading(true);
    expect(invoiceStore.getSnapshot().isLoading).toBe(true);

    invoiceStore.setLoading(false);
    expect(invoiceStore.getSnapshot().isLoading).toBe(false);
  });

  it("setError updates error and clears loading", () => {
    invoiceStore.setLoading(true);
    invoiceStore.setError("Something went wrong");

    const snapshot = invoiceStore.getSnapshot();
    expect(snapshot.error).toBe("Something went wrong");
    expect(snapshot.isLoading).toBe(false);
  });

  it("reset clears all state", () => {
    injectInvoices([makeInvoice({ id: "inv-1" })]);
    invoiceStore.setFilter({ status: "paid" });
    invoiceStore.setError("some error");

    invoiceStore.reset();

    const snapshot = invoiceStore.getSnapshot();
    expect(snapshot.invoices.size).toBe(0);
    expect(snapshot.filter).toEqual({});
    expect(snapshot.error).toBeNull();
  });
});

// ─── Pagination & filtering ──────────────────────────────────────────────────

describe("pagination and filtering", () => {
  it("getPage returns paginated invoices", () => {
    const invoices = Array.from({ length: 25 }, (_, i) =>
      makeInvoice({ id: `inv-${i}`, createdAt: new Date(2026, 0, i + 1).toISOString() })
    );
    injectInvoices(invoices);

    const page1 = invoiceStore.getPage();
    expect(page1.invoices).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.hasMore).toBe(true);
    expect(page1.page).toBe(1);
  });

  it("setPage changes the page", () => {
    const invoices = Array.from({ length: 25 }, (_, i) =>
      makeInvoice({ id: `inv-${i}` })
    );
    injectInvoices(invoices);

    invoiceStore.setPage(3);
    const page3 = invoiceStore.getPage();
    expect(page3.page).toBe(3);
    expect(page3.invoices).toHaveLength(5);
    expect(page3.hasMore).toBe(false);
  });

  it("setPage clamps to minimum 1", () => {
    invoiceStore.setPage(0);
    expect(invoiceStore.getSnapshot().page).toBe(1);

    invoiceStore.setPage(-5);
    expect(invoiceStore.getSnapshot().page).toBe(1);
  });

  it("setFilter by status", () => {
    injectInvoices([
      makeInvoice({ id: "inv-1", status: "draft" }),
      makeInvoice({ id: "inv-2", status: "paid" }),
      makeInvoice({ id: "inv-3", status: "draft" }),
    ]);

    invoiceStore.setFilter({ status: "draft" });
    const page = invoiceStore.getPage();
    expect(page.invoices).toHaveLength(2);
    expect(page.total).toBe(2);
  });

  it("setFilter by search", () => {
    injectInvoices([
      makeInvoice({ id: "inv-1", number: "INV-001", apiName: "Weather API" }),
      makeInvoice({ id: "inv-2", number: "INV-002", apiName: "Translation API" }),
    ]);

    invoiceStore.setFilter({ search: "weather" });
    const page = invoiceStore.getPage();
    expect(page.invoices).toHaveLength(1);
    expect(page.invoices[0].apiName).toBe("Weather API");
  });

  it("setFilter resets to page 1", () => {
    injectInvoices(Array.from({ length: 20 }, (_, i) => makeInvoice({ id: `inv-${i}` })));
    invoiceStore.setPage(3);

    invoiceStore.setFilter({ status: "paid" });
    expect(invoiceStore.getSnapshot().page).toBe(1);
  });

  it("setSort changes sort order", () => {
    injectInvoices([
      makeInvoice({ id: "inv-1", amount: 100, createdAt: "2026-01-01T00:00:00Z" }),
      makeInvoice({ id: "inv-2", amount: 50, createdAt: "2026-01-02T00:00:00Z" }),
      makeInvoice({ id: "inv-3", amount: 200, createdAt: "2026-01-03T00:00:00Z" }),
    ]);

    invoiceStore.setSort({ field: "amount", direction: "asc" });
    const page = invoiceStore.getPage();
    expect(page.invoices[0].amount).toBe(50);
    expect(page.invoices[2].amount).toBe(200);
  });
});

// ─── Status transitions (dispatch) ───────────────────────────────────────────

describe("dispatch", () => {
  it("draft -> pending succeeds", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "draft", version: 1 });
    injectInvoices([inv]);

    const promise = invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-1" });
    vi.advanceTimersByTime(1000);
    const result = await promise;
    expect(result).toBe(true);
    expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.status).toBe("pending");
    expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.version).toBe(2);
  });

  it("pending -> paid succeeds", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "pending", version: 1 });
    injectInvoices([inv]);

    const promise = invoiceStore.dispatch({ type: "PAY", invoiceId: "inv-1" });
    vi.advanceTimersByTime(1000);
    const result = await promise;
    expect(result).toBe(true);
    expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.status).toBe("paid");
    expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.paidAt).toBeDefined();
  });

  it("draft -> paid is rejected (invalid transition)", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "draft", version: 1 });
    injectInvoices([inv]);

    const result = await invoiceStore.dispatch({ type: "PAY", invoiceId: "inv-1" });
    expect(result).toBe(false);
    expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.status).toBe("draft");
    expect(invoiceStore.getSnapshot().error).toContain("Cannot pay");
  });

  it("paid -> cancelled is rejected (terminal state)", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "paid", version: 1 });
    injectInvoices([inv]);

    const result = await invoiceStore.dispatch({ type: "CANCEL", invoiceId: "inv-1" });
    expect(result).toBe(false);
    expect(invoiceStore.getSnapshot().error).toContain("Cannot cancel");
  });

  it("pending action blocks duplicate dispatch", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "draft", version: 1 });
    injectInvoices([inv]);

    // Start first dispatch (will take time due to simulated delay)
    const first = invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-1" });
    expect(invoiceStore.isPending("inv-1")).toBe(true);

    // Second dispatch should be rejected
    const second = await invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-1" });
    expect(second).toBe(false);
    expect(invoiceStore.getSnapshot().error).toContain("already in progress");

    // Wait for first to complete
    vi.advanceTimersByTime(1000);
    await first;
  });

  it("dispatch on missing invoice returns error", async () => {
    const result = await invoiceStore.dispatch({ type: "PAY", invoiceId: "nonexistent" });
    expect(result).toBe(false);
    expect(invoiceStore.getSnapshot().error).toBe("Invoice not found");
  });

  it("cancelled invoice cannot be sent", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "cancelled", version: 2 });
    injectInvoices([inv]);

    const result = await invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-1" });
    expect(result).toBe(false);
    expect(invoiceStore.getSnapshot().error).toContain("Cannot send");
  });

  it("overdue -> paid succeeds", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "overdue", version: 2 });
    injectInvoices([inv]);

    const promise = invoiceStore.dispatch({ type: "PAY", invoiceId: "inv-1" });
    vi.advanceTimersByTime(1000);
    const result = await promise;
    expect(result).toBe(true);
    expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.status).toBe("paid");
  });
});

// ─── Optimistic concurrency (version conflict) ───────────────────────────────

describe("version-based optimistic concurrency", () => {
  it("rejects action if version changed between read and write", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "draft", version: 1 });
    injectInvoices([inv]);

    // Simulate: start dispatch, then before it completes, inject a newer version
    const promise = invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-1" });

    // Simulate server-side update from another source
    const newer = { ...inv, version: 2, status: "pending" as InvoiceStatus };
    injectInvoices([newer]);

    vi.advanceTimersByTime(1000);
    const result = await promise;

    // The dispatch should detect version mismatch and fail
    expect(result).toBe(false);
    expect(invoiceStore.getSnapshot().error).toContain("modified by another operation");
  });

  it("allows concurrent dispatch on different invoices", async () => {
    const inv1 = makeInvoice({ id: "inv-1", status: "draft", version: 1 });
    const inv2 = makeInvoice({ id: "inv-2", status: "draft", version: 1 });
    injectInvoices([inv1, inv2]);

    const p1 = invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-1" });
    const p2 = invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-2" });

    vi.advanceTimersByTime(1000);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.status).toBe("pending");
    expect(invoiceStore.getSnapshot().invoices.get("inv-2")?.status).toBe("pending");
  });
});

// ─── Stale detection ─────────────────────────────────────────────────────────

describe("stale detection", () => {
  it("isStale returns true when no data fetched", () => {
    expect(invoiceStore.isStale()).toBe(true);
  });

  it("isStale returns false within threshold", () => {
    injectInvoices([makeInvoice()]);
    expect(invoiceStore.isStale()).toBe(false);
  });

  it("isStale returns true after threshold", () => {
    injectInvoices([makeInvoice()]);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(invoiceStore.isStale()).toBe(true);
  });
});

// ─── Subscription ────────────────────────────────────────────────────────────

describe("subscriptions", () => {
  it("notifies listeners on state change", () => {
    const cb = vi.fn();
    const unsub = invoiceStore.subscribe(cb);

    invoiceStore.setLoading(true);
    expect(cb).toHaveBeenCalledTimes(1);

    invoiceStore.setLoading(false);
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
    invoiceStore.setLoading(true);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

// ─── Dispatch clears error on success ────────────────────────────────────────

describe("error handling", () => {
  it("clears error on successful dispatch", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "draft", version: 1 });
    injectInvoices([inv]);
    invoiceStore.setError("previous error");

    const promise = invoiceStore.dispatch({ type: "SEND", invoiceId: "inv-1" });
    vi.advanceTimersByTime(1000);
    await promise;
    expect(invoiceStore.getSnapshot().error).toBeNull();
  });

  it("persists error on failed dispatch", async () => {
    const inv = makeInvoice({ id: "inv-1", status: "paid", version: 1 });
    injectInvoices([inv]);

    await invoiceStore.dispatch({ type: "PAY", invoiceId: "inv-1" });
    expect(invoiceStore.getSnapshot().error).toBeTruthy();
  });
});
