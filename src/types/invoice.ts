export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  version: number;
  amount: number;
  currency: string;
  createdAt: string;
  dueAt: string;
  paidAt?: string;
  cancelledAt?: string;
  apiName: string;
  items: InvoiceItem[];
}

export type InvoiceAction =
  | { type: "SEND"; invoiceId: string }
  | { type: "PAY"; invoiceId: string }
  | { type: "CANCEL"; invoiceId: string }
  | { type: "RETRY"; invoiceId: string };

export type InvoiceFilter = {
  status?: InvoiceStatus;
  search?: string;
};

export type SortDirection = "asc" | "desc";

export type InvoiceSort = {
  field: "createdAt" | "dueAt" | "amount";
  direction: SortDirection;
};

export interface InvoicePage {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface InvoicesState {
  invoices: Map<string, Invoice>;
  page: number;
  pageSize: number;
  filter: InvoiceFilter;
  sort: InvoiceSort;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  pendingActions: Set<string>;
}

export const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["paid", "cancelled", "overdue"],
  paid: [],
  overdue: ["paid", "cancelled"],
  cancelled: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
