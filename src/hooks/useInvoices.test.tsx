/**
 * useInvoices.test.ts
 *
 * Tests for the useInvoices hook.
 * Covers: initial state, subscription to store, and action delegation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useInvoices } from "./useInvoices";
import { invoiceStore } from "../state/invoiceStore";

beforeEach(() => {
  invoiceStore._reset();
});

afterEach(() => {
  invoiceStore._reset();
  vi.restoreAllMocks();
});

describe("useInvoices hook", () => {
  describe("initial state", () => {
    it("starts with empty page and no loading", () => {
      const { result } = renderHook(() => useInvoices());
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.page.invoices).toHaveLength(0);
      expect(result.current.page.total).toBe(0);
    });

    it("has correct pending actions set", () => {
      const { result } = renderHook(() => useInvoices());
      expect(result.current.pendingActions.size).toBe(0);
    });

    it("is stale when no data fetched", () => {
      const { result } = renderHook(() => useInvoices());
      expect(result.current.isStale).toBe(true);
    });
  });

  describe("subscription to store", () => {
    it("reflects store changes via subscription", async () => {
      const { result } = renderHook(() => useInvoices());

      act(() => {
        invoiceStore.setLoading(true);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      act(() => {
        invoiceStore.setLoading(false);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("reflects error state from store", async () => {
      const { result } = renderHook(() => useInvoices());

      act(() => {
        invoiceStore.setError("test error");
      });

      await waitFor(() => {
        expect(result.current.error).toBe("test error");
      });

      act(() => {
        invoiceStore.setError(null);
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it("reflects invoices loaded into store", async () => {
      const { result } = renderHook(() => useInvoices());

      expect(result.current.page.total).toBe(0);

      act(() => {
        invoiceStore.setInvoices([
          {
            id: "inv-1", number: "INV-1", status: "draft", version: 1,
            amount: 100, currency: "USDC", createdAt: "2026-01-01T00:00:00Z",
            dueAt: "2026-02-01T00:00:00Z", apiName: "Test API", items: [],
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.page.total).toBe(1);
      });
    });
  });

  describe("action delegation", () => {
    it("clearError delegates to store", async () => {
      const { result } = renderHook(() => useInvoices());

      act(() => {
        invoiceStore.setError("some error");
      });

      await waitFor(() => {
        expect(result.current.error).toBe("some error");
      });

      act(() => {
        result.current.clearError();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it("setFilter delegates to store", async () => {
      act(() => {
        invoiceStore.setInvoices([
          {
            id: "inv-1", number: "INV-1", status: "draft", version: 1,
            amount: 100, currency: "USDC", createdAt: "2026-01-01T00:00:00Z",
            dueAt: "2026-02-01T00:00:00Z", apiName: "Test API", items: [],
          },
          {
            id: "inv-2", number: "INV-2", status: "paid", version: 1,
            amount: 200, currency: "USDC", createdAt: "2026-01-02T00:00:00Z",
            dueAt: "2026-02-01T00:00:00Z", apiName: "Other API", items: [],
          },
        ]);
      });

      const { result } = renderHook(() => useInvoices());

      await waitFor(() => {
        expect(result.current.page.total).toBe(2);
      });

      act(() => {
        result.current.setFilter({ status: "paid" });
      });

      await waitFor(() => {
        expect(result.current.page.total).toBe(1);
        expect(result.current.page.invoices[0].status).toBe("paid");
      });
    });

    it("setSort delegates to store", async () => {
      act(() => {
        invoiceStore.setInvoices([
          {
            id: "inv-1", number: "INV-1", status: "draft", version: 1,
            amount: 200, currency: "USDC", createdAt: "2026-01-02T00:00:00Z",
            dueAt: "2026-02-01T00:00:00Z", apiName: "API-A", items: [],
          },
          {
            id: "inv-2", number: "INV-2", status: "draft", version: 1,
            amount: 50, currency: "USDC", createdAt: "2026-01-01T00:00:00Z",
            dueAt: "2026-02-01T00:00:00Z", apiName: "API-B", items: [],
          },
        ]);
      });

      const { result } = renderHook(() => useInvoices());

      await waitFor(() => {
        expect(result.current.page.total).toBe(2);
      });

      act(() => {
        result.current.setSort({ field: "amount", direction: "asc" });
      });

      await waitFor(() => {
        const amounts = result.current.page.invoices.map((inv) => inv.amount);
        expect(amounts).toEqual([50, 200]);
      });
    });

    it("setPage delegates to store", async () => {
      act(() => {
        invoiceStore.setInvoices(
          Array.from({ length: 25 }, (_, i) => ({
            id: `inv-${i}`, number: `INV-${i}`, status: "draft" as const,
            version: 1, amount: 100, currency: "USDC",
            createdAt: new Date(2026, 0, i + 1).toISOString(),
            dueAt: "2026-02-01T00:00:00Z", apiName: `API-${i}`, items: [],
          }))
        );
      });

      const { result } = renderHook(() => useInvoices());

      await waitFor(() => {
        expect(result.current.page.total).toBe(25);
      });

      act(() => {
        result.current.setPage(2);
      });

      await waitFor(() => {
        expect(result.current.page.page).toBe(2);
      });
    });

    it("dispatch delegates to store", async () => {
      act(() => {
        invoiceStore.setInvoices([
          {
            id: "inv-1", number: "INV-1", status: "draft", version: 1,
            amount: 100, currency: "USDC", createdAt: "2026-01-01T00:00:00Z",
            dueAt: "2026-02-01T00:00:00Z", apiName: "Test API", items: [],
          },
        ]);
      });

      const { result } = renderHook(() => useInvoices());

      await waitFor(() => {
        expect(result.current.page.total).toBe(1);
      });

      vi.useFakeTimers();
      let success = false;
      await act(async () => {
        const p = result.current.sendInvoice("inv-1");
        vi.advanceTimersByTime(1000);
        success = await p;
      });

      expect(success).toBe(true);
      expect(invoiceStore.getSnapshot().invoices.get("inv-1")?.status).toBe("pending");
      vi.useRealTimers();
    });
  });
});
