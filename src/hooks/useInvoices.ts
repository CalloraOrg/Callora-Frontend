import { useCallback, useEffect, useRef, useState } from "react";
import { invoiceStore } from "../state/invoiceStore";
import type { InvoiceAction, InvoiceFilter, InvoicePage, InvoiceSort } from "../types/invoice";

const MOCK_INVOICES = [
  {
    id: "inv-001",
    number: "INV-2026-001",
    status: "draft" as const,
    version: 1,
    amount: 120.5,
    currency: "USDC",
    createdAt: "2026-08-15T10:00:00Z",
    dueAt: "2026-09-15T10:00:00Z",
    apiName: "Weather API",
    items: [
      { id: "item-1", description: "500 API calls", quantity: 1, unitPrice: 120.5, amount: 120.5 },
    ],
  },
  {
    id: "inv-002",
    number: "INV-2026-002",
    status: "pending" as const,
    version: 2,
    amount: 340.0,
    currency: "USDC",
    createdAt: "2026-08-20T14:30:00Z",
    dueAt: "2026-09-20T14:30:00Z",
    apiName: "Translation API",
    items: [
      { id: "item-2", description: "1000 API calls", quantity: 1, unitPrice: 340.0, amount: 340.0 },
    ],
  },
  {
    id: "inv-003",
    number: "INV-2026-003",
    status: "paid" as const,
    version: 3,
    amount: 75.25,
    currency: "USDC",
    createdAt: "2026-07-01T09:00:00Z",
    dueAt: "2026-08-01T09:00:00Z",
    paidAt: "2026-07-28T16:45:00Z",
    apiName: "Geocoding API",
    items: [
      { id: "item-3", description: "250 API calls", quantity: 1, unitPrice: 75.25, amount: 75.25 },
    ],
  },
  {
    id: "inv-004",
    number: "INV-2026-004",
    status: "overdue" as const,
    version: 2,
    amount: 500.0,
    currency: "USDC",
    createdAt: "2026-06-10T12:00:00Z",
    dueAt: "2026-07-10T12:00:00Z",
    apiName: "Image Processing API",
    items: [
      { id: "item-4", description: "2000 API calls", quantity: 1, unitPrice: 500.0, amount: 500.0 },
    ],
  },
  {
    id: "inv-005",
    number: "INV-2026-005",
    status: "cancelled" as const,
    version: 2,
    amount: 95.0,
    currency: "USDC",
    createdAt: "2026-08-05T08:00:00Z",
    dueAt: "2026-09-05T08:00:00Z",
    cancelledAt: "2026-08-10T11:20:00Z",
    apiName: "SMS Gateway API",
    items: [
      { id: "item-5", description: "100 API calls", quantity: 1, unitPrice: 95.0, amount: 95.0 },
    ],
  },
];

function simulateServerDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));
}

export interface UseInvoicesReturn {
  page: InvoicePage;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  pendingActions: Set<string>;
  fetchInvoices: () => Promise<void>;
  dispatch: (action: InvoiceAction) => Promise<boolean>;
  sendInvoice: (id: string) => Promise<boolean>;
  payInvoice: (id: string) => Promise<boolean>;
  cancelInvoice: (id: string) => Promise<boolean>;
  setFilter: (filter: InvoiceFilter) => void;
  setSort: (sort: InvoiceSort) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  retryFetch: () => Promise<void>;
}

function useForceUpdate() {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((t) => t + 1), []);
}

export function useInvoices(): UseInvoicesReturn {
  const forceUpdate = useForceUpdate();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const unsub = invoiceStore.subscribe(forceUpdate);
    return () => {
      unsub();
      abortRef.current?.abort();
    };
  }, [forceUpdate]);

  const snapshot = invoiceStore.getSnapshot();

  const fetchInvoices = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    invoiceStore.setLoading(true);
    invoiceStore.setError(null);

    try {
      await simulateServerDelay();

      if (controller.signal.aborted) return;

      invoiceStore.setInvoices(MOCK_INVOICES);
    } catch {
      if (!controller.signal.aborted) {
        invoiceStore.setError("Failed to fetch invoices");
      }
    }
  }, []);

  const dispatch = useCallback(
    async (action: InvoiceAction): Promise<boolean> => {
      return invoiceStore.dispatch(action);
    },
    []
  );

  const sendInvoice = useCallback(
    async (id: string): Promise<boolean> => {
      return dispatch({ type: "SEND", invoiceId: id });
    },
    [dispatch]
  );

  const payInvoice = useCallback(
    async (id: string): Promise<boolean> => {
      return dispatch({ type: "PAY", invoiceId: id });
    },
    [dispatch]
  );

  const cancelInvoice = useCallback(
    async (id: string): Promise<boolean> => {
      return dispatch({ type: "CANCEL", invoiceId: id });
    },
    [dispatch]
  );

  const setFilter = useCallback((filter: InvoiceFilter) => {
    invoiceStore.setFilter(filter);
  }, []);

  const setSort = useCallback((sort: InvoiceSort) => {
    invoiceStore.setSort(sort);
  }, []);

  const setPage = useCallback((page: number) => {
    invoiceStore.setPage(page);
  }, []);

  const clearError = useCallback(() => {
    invoiceStore.setError(null);
  }, []);

  const retryFetch = useCallback(async () => {
    await fetchInvoices();
  }, [fetchInvoices]);

  return {
    page: invoiceStore.getPage(),
    isLoading: snapshot.isLoading,
    isStale: invoiceStore.isStale(),
    error: snapshot.error,
    pendingActions: snapshot.pendingActions,
    fetchInvoices,
    dispatch,
    sendInvoice,
    payInvoice,
    cancelInvoice,
    setFilter,
    setSort,
    setPage,
    clearError,
    retryFetch,
  };
}
