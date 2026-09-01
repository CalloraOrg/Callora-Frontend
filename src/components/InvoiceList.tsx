import InvoiceCard from "./InvoiceCard";
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";
import type { Invoice, InvoiceAction, InvoiceFilter, InvoiceSort, InvoiceStatus } from "../types/invoice";

interface InvoiceListProps {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  pendingActions: Set<string>;
  filter: InvoiceFilter;
  sort: InvoiceSort;
  total: number;
  page: number;
  hasMore: boolean;
  onAction: (action: InvoiceAction) => Promise<boolean>;
  onFilterChange: (filter: InvoiceFilter) => void;
  onSortChange: (sort: InvoiceSort) => void;
  onPageChange: (page: number) => void;
  onRetry: () => Promise<void>;
}

const STATUS_OPTIONS: InvoiceStatus[] = [
  "draft",
  "pending",
  "paid",
  "overdue",
  "cancelled",
];

const SORT_OPTIONS: { field: InvoiceSort["field"]; label: string }[] = [
  { field: "createdAt", label: "Date created" },
  { field: "dueAt", label: "Due date" },
  { field: "amount", label: "Amount" },
];

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="surface"
          style={{
            padding: "20px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <Skeleton width="120px" height="18px" />
              <Skeleton width="100px" height="14px" />
            </div>
            <Skeleton width="80px" height="26px" borderRadius="999px" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Skeleton width="100px" height="22px" />
            <Skeleton width="110px" height="14px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InvoiceList({
  invoices,
  isLoading,
  error,
  pendingActions,
  filter,
  sort,
  total,
  page,
  hasMore,
  onAction,
  onFilterChange,
  onSortChange,
  onPageChange,
  onRetry,
}: InvoiceListProps) {
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Failed to load invoices"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (isLoading && invoices.length === 0) {
    return <SkeletonList />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
        role="toolbar"
        aria-label="Invoice filters and sorting"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label
            htmlFor="invoice-status-filter"
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            Status:
          </label>
          <select
            id="invoice-status-filter"
            className="filter-select"
            value={filter.status ?? ""}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                status: (e.target.value as InvoiceStatus) || undefined,
              })
            }
            style={{
              minHeight: "36px",
              fontSize: "0.8125rem",
            }}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label
            htmlFor="invoice-search"
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            Search:
          </label>
          <input
            id="invoice-search"
            type="text"
            className="filter-select"
            placeholder="Invoice or API name"
            value={filter.search ?? ""}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                search: e.target.value || undefined,
              })
            }
            style={{
              minHeight: "36px",
              fontSize: "0.8125rem",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label
            htmlFor="invoice-sort"
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            Sort:
          </label>
          <select
            id="invoice-sort"
            className="filter-select"
            value={`${sort.field}-${sort.direction}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split("-");
              onSortChange({
                field: field as InvoiceSort["field"],
                direction: direction as InvoiceSort["direction"],
              });
            }}
            style={{
              minHeight: "36px",
              fontSize: "0.8125rem",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.field}-desc`} value={`${opt.field}-desc`}>
                {opt.label} (newest first)
              </option>
            ))}
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.field}-asc`} value={`${opt.field}-asc`}>
                {opt.label} (oldest first)
              </option>
            ))}
          </select>
        </div>

        {filter.status || filter.search ? (
          <button
            className="ghost-button"
            onClick={() => onFilterChange({})}
            type="button"
            style={{
              minHeight: "36px",
              fontSize: "0.8125rem",
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <p
        style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}
        role="status"
        aria-live="polite"
      >
        {total} invoice{total !== 1 ? "s" : ""} found
      </p>

      {invoices.length === 0 && !isLoading ? (
        <EmptyState
          variant="empty"
          title="No invoices found"
          message={
            filter.status || filter.search
              ? "No invoices match your filters."
              : "Invoices will appear here once you use API services."
          }
          size="compact"
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
          role="list"
          aria-label="Invoices"
        >
          {invoices.map((invoice) => (
            <div key={invoice.id} role="listitem">
              <InvoiceCard
                invoice={invoice}
                isPending={pendingActions.has(invoice.id)}
                onAction={onAction}
              />
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <nav
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
          }}
          aria-label="Invoice pagination"
        >
          <button
            className="ghost-button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            type="button"
            style={{ minHeight: "36px", fontSize: "0.8125rem" }}
          >
            Previous
          </button>
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Page {page}
          </span>
          <button
            className="ghost-button"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore}
            type="button"
            style={{ minHeight: "36px", fontSize: "0.8125rem" }}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
