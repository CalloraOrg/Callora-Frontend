import Skeleton from "./Skeleton";
import type { BalanceReadStatus } from "../hooks/useVaultBalances";
import "./BalanceReadout.css";

export type { BalanceReadStatus };

export interface BalanceReadoutProps {
  /** Formatted USDC amount without the " USDC" suffix. Null while unknown. */
  value: string | null;
  /** Read lifecycle shared by the billing surface, modal and dashboard. */
  status: BalanceReadStatus;
  /** False when no vault contract is configured; nothing can be read. */
  configured?: boolean;
  /** Failure message shown with a Retry action. */
  error?: string | null;
  /** Retry handler for the failed read. */
  onRetry?: () => void;
  /** Text used when there is no value and no failure, e.g. "Connect wallet". */
  placeholder?: string;
  /** Accessible name for this balance, e.g. "Vault balance". */
  label: string;
  /** Marks an optimistic value that a chain re-read has not confirmed yet. */
  pending?: boolean;
  className?: string;
}

/**
 * Renders one on-chain balance with explicit loading, error, and
 * not-configured states.
 *
 * - Values are formatted upstream (stroops → exact string) so nothing here
 *   converts money through `Number`.
 * - Loading uses a fixed-size skeleton marked `aria-busy` so the surrounding
 *   card never shifts while the read is in flight.
 * - Failures show the message plus a Retry button and never render `0` as if
 *   it were a real balance.
 */
export default function BalanceReadout({
  value,
  status,
  configured = true,
  error = null,
  onRetry,
  placeholder,
  label,
  pending = false,
  className,
}: BalanceReadoutProps) {
  const classes = ["balance-readout", className].filter(Boolean).join(" ");

  if (!configured) {
    return (
      <strong className={`${classes} balance-readout--muted`} data-testid={`balance-${toTestId(label)}`}>
        Vault not configured
      </strong>
    );
  }

  if (value !== null) {
    return (
      <strong className={classes} data-testid={`balance-${toTestId(label)}`}>
        {value} USDC
        {pending && (
          <span className="balance-readout__pending">pending refresh</span>
        )}
      </strong>
    );
  }

  if (error) {
    return (
      <div className={`${classes} balance-readout--error`} data-testid={`balance-${toTestId(label)}`}>
        <span className="balance-readout__error-text">{error}</span>
        {onRetry && (
          <button
            type="button"
            className="ghost-button balance-readout__retry"
            onClick={onRetry}
            aria-label={`Retry loading ${label}`}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <strong
        className={`${classes} balance-readout--loading`}
        aria-busy="true"
        data-testid={`balance-${toTestId(label)}-loading`}
      >
        <span className="sr-only">Loading {label}</span>
        <Skeleton width="7ch" height="1em" />
      </strong>
    );
  }

  return (
    <strong className={`${classes} balance-readout--muted`} data-testid={`balance-${toTestId(label)}`}>
      {placeholder ?? "—"}
    </strong>
  );
}

function toTestId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
