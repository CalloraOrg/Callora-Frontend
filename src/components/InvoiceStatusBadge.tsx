import type { InvoiceStatus } from "../types/invoice";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; colorVar: string }> = {
  draft: { label: "Draft", colorVar: "--muted" },
  pending: { label: "Pending", colorVar: "--warning" },
  paid: { label: "Paid", colorVar: "--success" },
  overdue: { label: "Overdue", colorVar: "--danger" },
  cancelled: { label: "Cancelled", colorVar: "--muted" },
};

export default function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className="invoice-status-badge"
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: "999px",
        fontSize: "0.8125rem",
        fontWeight: "600",
        color: `var(${config.colorVar})`,
        background: `color-mix(in srgb, var(${config.colorVar}) 12%, transparent)`,
        border: `1px solid color-mix(in srgb, var(${config.colorVar}) 25%, transparent)`,
        whiteSpace: "nowrap",
      }}
      aria-label={`Status: ${config.label}`}
    >
      <span
        aria-hidden="true"
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: `var(${config.colorVar})`,
        }}
      />
      {config.label}
    </span>
  );
}
