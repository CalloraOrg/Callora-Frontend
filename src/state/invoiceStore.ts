import { useSyncExternalStore } from "react";
import type {
  Invoice,
  InvoiceAction,
  InvoiceFilter,
  InvoicePage,
  InvoiceSort,
  InvoiceStatus,
  InvoicesState,
} from "../types/invoice";
import { canTransition } from "../types/invoice";

const STORAGE_KEY = "callora_invoice_state";
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

type Listener = () => void;

let state: InvoicesState = {
  invoices: new Map(),
  page: 1,
  pageSize: 10,
  filter: {},
  sort: { field: "createdAt", direction: "desc" },
  isLoading: false,
  error: null,
  lastFetchedAt: null,
  pendingActions: new Set(),
};

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(partial: Partial<InvoicesState>) {
  state = { ...state, ...partial };
  emitChange();
}

function persist() {
  try {
    const serializable = {
      ...state,
      invoices: Array.from(state.invoices.entries()),
      pendingActions: Array.from(state.pendingActions),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Silent fail for private mode / quota
  }
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state = {
      ...state,
      ...parsed,
      invoices: new Map(parsed.invoices ?? []),
      pendingActions: new Set(parsed.pendingActions ?? []),
    };
  } catch {
    // Corrupt data — start fresh
  }
}

hydrate();

function getInvoicesForPage(): Invoice[] {
  let invoices = Array.from(state.invoices.values());

  if (state.filter.status) {
    invoices = invoices.filter((inv) => inv.status === state.filter.status);
  }

  if (state.filter.search) {
    const q = state.filter.search.toLowerCase();
    invoices = invoices.filter(
      (inv) =>
        inv.number.toLowerCase().includes(q) ||
        inv.apiName.toLowerCase().includes(q)
    );
  }

  invoices.sort((a, b) => {
    const { field, direction } = state.sort;
    const aVal = a[field];
    const bVal = b[field];
    const cmp =
      typeof aVal === "string" && typeof bVal === "string"
        ? aVal.localeCompare(bVal)
        : Number(aVal) - Number(bVal);
    return direction === "asc" ? cmp : -cmp;
  });

  return invoices;
}

function validateTransition(
  invoice: Invoice,
  action: InvoiceAction
): Invoice | null {
  if (state.pendingActions.has(invoice.id)) return null;

  switch (action.type) {
    case "SEND":
      if (!canTransition(invoice.status, "pending")) return null;
      return {
        ...invoice,
        status: "pending" as InvoiceStatus,
        version: invoice.version + 1,
      };
    case "PAY":
      if (!canTransition(invoice.status, "paid")) return null;
      return {
        ...invoice,
        status: "paid" as InvoiceStatus,
        version: invoice.version + 1,
        paidAt: new Date().toISOString(),
      };
    case "CANCEL":
      if (!canTransition(invoice.status, "cancelled")) return null;
      return {
        ...invoice,
        status: "cancelled" as InvoiceStatus,
        version: invoice.version + 1,
        cancelledAt: new Date().toISOString(),
      };
    case "RETRY":
      if (!canTransition(invoice.status, "pending")) return null;
      return {
        ...invoice,
        status: "pending" as InvoiceStatus,
        version: invoice.version + 1,
      };
    default:
      return null;
  }
}

function reconcileIncomingServerInvoice(serverInvoice: Invoice) {
  const existing = state.invoices.get(serverInvoice.id);
  if (!existing) {
    state.invoices.set(serverInvoice.id, serverInvoice);
    return;
  }
  if (serverInvoice.version >= existing.version) {
    state.invoices.set(serverInvoice.id, serverInvoice);
  }
}

export const invoiceStore = {
  getSnapshot(): InvoicesState {
    return state;
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        hydrate();
        emitChange();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },

  getPage(): InvoicePage {
    const all = getInvoicesForPage();
    const start = (state.page - 1) * state.pageSize;
    const invoices = all.slice(start, start + state.pageSize);
    return {
      invoices,
      total: all.length,
      page: state.page,
      pageSize: state.pageSize,
      hasMore: start + state.pageSize < all.length,
    };
  },

  isStale(): boolean {
    if (!state.lastFetchedAt) return true;
    return Date.now() - state.lastFetchedAt > STALE_THRESHOLD_MS;
  },

  isLoading(): boolean {
    return state.isLoading;
  },

  hasError(): boolean {
    return state.error !== null;
  },

  getError(): string | null {
    return state.error;
  },

  isPending(invoiceId: string): boolean {
    return state.pendingActions.has(invoiceId);
  },

  setInvoices(invoices: Invoice[]) {
    const map = new Map(state.invoices);
    for (const inv of invoices) {
      reconcileIncomingServerInvoice.call(null, inv);
      const existing = map.get(inv.id);
      if (!existing || inv.version >= existing.version) {
        map.set(inv.id, inv);
      }
    }
    setState({
      invoices: map,
      lastFetchedAt: Date.now(),
      isLoading: false,
      error: null,
    });
    persist();
  },

  setPage(page: number) {
    setState({ page: Math.max(1, page) });
    persist();
  },

  setFilter(filter: InvoiceFilter) {
    setState({ filter, page: 1 });
    persist();
  },

  setSort(sort: InvoiceSort) {
    setState({ sort, page: 1 });
    persist();
  },

  setLoading(loading: boolean) {
    setState({ isLoading: loading });
  },

  setError(error: string | null) {
    setState({ error, isLoading: false });
  },

  async dispatch(action: InvoiceAction): Promise<boolean> {
    const invoice = state.invoices.get(action.invoiceId);
    if (!invoice) {
      setState({ error: "Invoice not found" });
      return false;
    }

    const nextInvoice = validateTransition(invoice, action);
    if (!nextInvoice) {
      if (state.pendingActions.has(invoice.id)) {
        setState({ error: "Action already in progress" });
      } else {
        setState({
          error: `Cannot ${action.type.toLowerCase()} invoice in "${invoice.status}" status`,
        });
      }
      return false;
    }

    const pendingActions = new Set(state.pendingActions);
    pendingActions.add(invoice.id);
    setState({ pendingActions, error: null });

    try {
      await simulateServerDelay();

      const current = state.invoices.get(invoice.id);
      if (!current || current.version !== invoice.version) {
        setState({
          error: "Invoice was modified by another operation. Refreshing.",
          pendingActions: new Set(
            [...pendingActions].filter((id) => id !== invoice.id)
          ),
        });
        return false;
      }

      const newInvoices = new Map(state.invoices);
      newInvoices.set(nextInvoice.id, nextInvoice);
      const updatedPending = new Set(state.pendingActions);
      updatedPending.delete(invoice.id);

      setState({
        invoices: newInvoices,
        pendingActions: updatedPending,
      });
      persist();
      return true;
    } catch {
      const updatedPending = new Set(state.pendingActions);
      updatedPending.delete(invoice.id);
      setState({
        pendingActions: updatedPending,
        error: "Operation failed. Please try again.",
      });
      return false;
    }
  },

  reset() {
    state = {
      invoices: new Map(),
      page: 1,
      pageSize: 10,
      filter: {},
      sort: { field: "createdAt", direction: "desc" },
      isLoading: false,
      error: null,
      lastFetchedAt: null,
      pendingActions: new Set(),
    };
    localStorage.removeItem(STORAGE_KEY);
    emitChange();
  },

  _reset() {
    this.reset();
  },
};

function simulateServerDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
}

export function useInvoices(): InvoicesState {
  return useSyncExternalStore(
    invoiceStore.subscribe,
    invoiceStore.getSnapshot,
    invoiceStore.getSnapshot
  );
}
