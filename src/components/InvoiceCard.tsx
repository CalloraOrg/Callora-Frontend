import InvoiceStatusBadge from "./InvoiceStatusBadge";
import type { Invoice, InvoiceAction } from "../types/invoice";

interface InvoiceCardProps {
  invoice: Invoice;
  isPending: boolean;
  onAction: (action: InvoiceAction) => Promise<boolean>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function getAvailableActions(
  status: Invoice["status"]
): Invoice["status"][] {
  const transitions: Record<Invoice["status"], Invoice["status"][]> = {
    draft: ["pending", "cancelled"],
    pending: ["paid", "cancelled", "overdue"],
    paid: [],
    overdue: ["paid", "cancelled"],
    cancelled: [],
  };
  return transitions[status] ?? [];
}

function getActionInfo(
  sourceStatus: Invoice["status"],
  targetStatus: Invoice["status"]
): { label: string; actionType: InvoiceAction["type"] } | null {
  const transitions: Record<
    Invoice["status"],
    Partial<Record<Invoice["status"], { label: string; actionType: InvoiceAction["type"] }>>
  > = {
    draft: {
      pending: { label: "Send", actionType: "SEND" },
      cancelled: { label: "Cancel", actionType: "CANCEL" },
    },
    pending: {
      paid: { label: "Mark Paid", actionType: "PAY" },
      cancelled: { label: "Cancel", actionType: "CANCEL" },
    },
    overdue: {
      paid: { label: "Mark Paid", actionType: "PAY" },
      cancelled: { label: "Cancel", actionType: "CANCEL" },
    },
    paid: {},
    cancelled: {},
  };
  return transitions[sourceStatus]?.[targetStatus] ?? null;
}

export default function InvoiceCard({
  invoice,
  isPending,
  onAction,
}: InvoiceCardProps) {
  const availableTargets = getAvailableActions(invoice.status);

  const handleAction = async (targetStatus: Invoice["status"]) => {
    const info = getActionInfo(invoice.status, targetStatus);
    if (!info) return;
    await onAction({
      type: info.actionType,
      invoiceId: invoice.id,
    });
  };

  return (
    <article
      className="surface invoice-card"
      style={{
        padding: "20px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        opacity: isPending ? 0.7 : 1,
        transition: "opacity 200ms",
      }}
      aria-busy={isPending}
      aria-label={`Invoice ${invoice.number}`}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <strong
            style={{ fontSize: "1rem", color: "var(--text)" }}
          >
            {invoice.number}
          </strong>
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            {invoice.apiName}
          </span>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "1.25rem",
            fontWeight: "700",
            color: "var(--text)",
          }}
        >
          {formatAmount(invoice.amount, invoice.currency)}
        </span>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Due {formatDate(invoice.dueAt)}
        </span>
      </div>

      {invoice.paidAt && (
        <span style={{ fontSize: "0.8125rem", color: "var(--success)" }}>
          Paid on {formatDate(invoice.paidAt)}
        </span>
      )}

      {invoice.cancelledAt && (
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Cancelled on {formatDate(invoice.cancelledAt)}
        </span>
      )}

      {availableTargets.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            paddingTop: "8px",
            borderTop: "1px solid var(--line)",
          }}
          role="group"
          aria-label="Invoice actions"
        >
          {availableTargets
            .filter((t) => t !== "overdue")
            .map((target) => (
              <button
                key={target}
                className={
                  target === "cancelled" ? "ghost-button" : "primary-button"
                }
                onClick={() => handleAction(target)}
                disabled={isPending}
                aria-busy={isPending}
                type="button"
                style={{
                  minHeight: "36px",
                  fontSize: "0.8125rem",
                }}
              >
                {isPending ? "Processing…" : getActionInfo(invoice.status, target)?.label}
              </button>
            ))}
        </div>
      )}
    </article>
  );
}
