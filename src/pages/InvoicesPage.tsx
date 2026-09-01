import { useEffect } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useInvoices } from "../hooks/useInvoices";
import InvoiceList from "../components/InvoiceList";

export default function InvoicesPage() {
  useDocumentTitle("Invoices – Callora", "View and manage your API usage invoices.");

  const {
    page,
    isLoading,
    isStale,
    error,
    pendingActions,
    fetchInvoices,
    dispatch,
    setFilter,
    setSort,
    setPage,
    clearError,
    retryFetch,
  } = useInvoices();

  useEffect(() => {
    if (page.invoices.length === 0 || isStale) {
      fetchInvoices();
    }
  }, []);

  return (
    <section className="billing-layout">
      <div className="surface billing-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Invoices</p>
            <h1>Your API usage invoices</h1>
          </div>
          {isStale && !isLoading && (
            <button
              className="ghost-button"
              onClick={retryFetch}
              type="button"
              aria-label="Refresh invoices"
              style={{ minHeight: "36px", fontSize: "0.8125rem" }}
            >
              Refresh
            </button>
          )}
        </div>

        <InvoiceList
          invoices={page.invoices}
          isLoading={isLoading}
          error={error}
          pendingActions={pendingActions}
          filter={{}}
          sort={{ field: "createdAt", direction: "desc" }}
          total={page.total}
          page={page.page}
          hasMore={page.hasMore}
          onAction={dispatch}
          onFilterChange={setFilter}
          onSortChange={setSort}
          onPageChange={setPage}
          onRetry={retryFetch}
        />
      </div>
    </section>
  );
}
