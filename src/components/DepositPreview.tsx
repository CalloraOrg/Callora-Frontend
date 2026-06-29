// DepositPreview.tsx – a reusable preview component for the Deposit USDC modal
// Uses semantic HTML and ARIA labels for accessibility.
// No external dependencies are added; it relies on existing utils for formatting.

import { formatUsdc } from '../utils/format';

interface DepositPreviewProps {
  /** Current vault balance before the deposit */
  previewCurrentBalance: number;
  /** Projected vault balance after the deposit */
  projectedBalance: number;
  /** Network fee string (e.g., "0.0001") */
  networkFee: string;
  /** Amount the user is depositing (USDC) */
  amount: number;
  /** Whether a valid amount is present */
  hasAmount: boolean;
  /** Current wallet balance (used to compute post‑deposit wallet balance) */
  walletBalance: number;
  /** ARIA label for the preview section */
  ariaLabel?: string;
}

/**
 * DepositPreview displays a side‑by‑side "Before / After" view of balances.
 * It collapses to a single column on narrow viewports via CSS Grid.
 */
export default function DepositPreview({
  previewCurrentBalance,
  projectedBalance,
  networkFee,
  amount,
  hasAmount,
  walletBalance,
  ariaLabel = 'Deposit transaction preview',
}: DepositPreviewProps) {
  const newWalletBalance = hasAmount ? walletBalance - amount : walletBalance;

  return (
    <section className="deposit-preview" aria-label={ariaLabel}>
      {/* BEFORE column */}
      <div className="preview-column before" aria-label="Before balances">
        <ul>
          <li>
            <span>Vault balance</span>
            <strong>{formatUsdc(previewCurrentBalance)} USDC</strong>
          </li>
          <li>
            <span>Wallet balance</span>
            <strong>{formatUsdc(walletBalance)} USDC</strong>
          </li>
        </ul>
      </div>

      {/* AFTER column */}
      <div className="preview-column after" aria-label="After balances">
        <ul>
          <li>
            <span>New vault balance</span>
            <strong>{formatUsdc(projectedBalance)} USDC</strong>
          </li>
          <li>
            <span>New wallet balance</span>
            <strong>{formatUsdc(newWalletBalance)} USDC</strong>
          </li>
          <li className="network-fee">
            <span>Network fee</span>
            <strong>{networkFee}</strong>
          </li>
          <li className="total">
            <span>Total cost</span>
            <strong>
              {hasAmount
                ? `${formatUsdc(amount)} USDC + ${networkFee}`
                : `0 USDC + ${networkFee}`}
            </strong>
          </li>
        </ul>
      </div>
    </section>
  );
}
