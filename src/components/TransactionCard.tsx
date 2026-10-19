import StatusBadge from './StatusBadge';
import { formatUsdcAmount } from '../utils/format';
import type { BillingTransaction } from '../pages/BillingHistory';

export interface TransactionCardProps {
  tx: BillingTransaction;
  /** Already-formatted, timezone-aware date text. */
  dateText: string;
  statusLabel: string;
  /** Receives the button so the caller can return focus to it later. */
  onDetails: (tx: BillingTransaction, trigger: HTMLButtonElement) => void;
}

export function TransactionCard({ tx, dateText, statusLabel, onDetails }: TransactionCardProps) {
  const sign = tx.direction === 'credit' ? '+' : '\u2212';
  return (
    <li className="bh-card" data-testid={`bh-card-${tx.id}`}>
      <div className="bh-card__top">
        <h2 className="bh-card__title">{tx.description}</h2>
        <StatusBadge status={tx.status} label={statusLabel} />
      </div>
      <p className={`bh-card__amount tabular-nums bh-tone--${tx.direction}`}>
        {sign}{formatUsdcAmount(tx.amount)} USDC
      </p>
      <div className="bh-card__footer">
        <time dateTime={tx.timestamp}>{dateText}</time>
        <button
          type="button"
          className="bh-card__details"
          aria-label={`Details for ${tx.description}`}
          onClick={(e) => onDetails(tx, e.currentTarget)}
        >
          Details
        </button>
      </div>
    </li>
  );
}

export default TransactionCard;
