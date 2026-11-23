// DepositPreview.tsx – a reusable preview component for the Deposit USDC modal
// Uses semantic HTML and ARIA labels for accessibility.
// No external dependencies are added; it relies on existing utils for formatting.

import { useEffect, useState } from 'react';
import { HORIZON_FEE_STATS_URL, NETWORK_FEE_CACHE_TTL_MS } from '../config/constants';
import { formatUsdc, formatUsdcStroops } from '../utils/format';
import type { InvokeTransactionSummary } from '../services/txSummary';

type FeeStats = {
  fee_charged?: { mode?: string | number };
  max_fee?: { mode?: string | number };
};

let cachedFee: { value: string; expiresAt: number } | null = null;
let feeRequest: Promise<string | null> | null = null;

export function formatStroops(stroops: string | number | bigint) {
  const value = typeof stroops === 'bigint' ? Number(stroops) : Number(stroops);
  if (!Number.isFinite(value) || value < 0) return null;

  const xlm = (value / 10_000_000).toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
  return `${xlm} XLM`;
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

async function fetchNetworkFee() {
  if (cachedFee && cachedFee.expiresAt > Date.now()) return cachedFee.value;
  if (feeRequest) return feeRequest;

  feeRequest = fetch(HORIZON_FEE_STATS_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Horizon fee request failed: ${response.status}`);
      const stats = (await response.json()) as FeeStats;
      const recommended = stats.fee_charged?.mode ?? stats.max_fee?.mode;
      const fee = recommended === undefined ? null : formatStroops(recommended);
      if (!fee) throw new Error('Horizon response did not include a valid fee');

      cachedFee = { value: fee, expiresAt: Date.now() + NETWORK_FEE_CACHE_TTL_MS };
      return fee;
    })
    .catch(() => null)
    .finally(() => {
      feeRequest = null;
    });

  return feeRequest;
}

export function clearNetworkFeeCache() {
  cachedFee = null;
  feeRequest = null;
}

export function useNetworkFee(fallbackFee: string, enabled = true) {
  const [networkFee, setNetworkFee] = useState(fallbackFee);
  const [isEstimated, setIsEstimated] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    let isCurrent = true;
    setNetworkFee(fallbackFee);
    setIsEstimated(true);
    fetchNetworkFee().then((fee) => {
      if (!isCurrent) return;
      if (fee) {
        setNetworkFee(fee);
        setIsEstimated(false);
      } else {
        setNetworkFee(fallbackFee);
        setIsEstimated(true);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [enabled, fallbackFee]);

  return { networkFee, isEstimated };
}

export function TransactionSummaryDetails({
  summary,
}: {
  summary: InvokeTransactionSummary;
}) {
  const [copiedContract, setCopiedContract] = useState(false);
  const feeDisplay = formatStroops(summary.feeStroops) ?? `${summary.feeStroops.toString()} stroops`;

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(summary.contractId);
      setCopiedContract(true);
      globalThis.setTimeout(() => setCopiedContract(false), 1500);
    } catch {
      setCopiedContract(false);
    }
  };

  return (
    <dl className="tx-summary-list" aria-label="Soroban transaction summary">
      <div className="preview-row">
        <dt>Contract</dt>
        <dd>
          <span title={summary.contractId}>{shortenAddress(summary.contractId)}</span>{' '}
          <button
            type="button"
            className="ghost-button"
            onClick={handleCopyContract}
            aria-label="Copy contract address"
          >
            {copiedContract ? 'Copied' : 'Copy'}
          </button>
        </dd>
      </div>
      <div className="preview-row">
        <dt>Function</dt>
        <dd>{summary.functionName}</dd>
      </div>
      {summary.amountStroops !== undefined && (
        <div className="preview-row">
          <dt>Amount</dt>
          <dd>{formatUsdcStroops(summary.amountStroops)} USDC</dd>
        </div>
      )}
      <div className="preview-row">
        <dt>Network fee</dt>
        <dd>{feeDisplay}</dd>
      </div>
      <div className="preview-row">
        <dt>Network</dt>
        <dd>{summary.network}</dd>
      </div>
    </dl>
  );
}

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
  /** Decoded Soroban transaction summary from the assembled XDR */
  txSummary?: InvokeTransactionSummary | null;
  /** Whether the transaction summary is currently being prepared */
  isPreparing?: boolean;
  /** Optional confirmation callback invoked after the user reviews the summary */
  onConfirmSign?: () => void;
  /** Whether signing is currently in progress */
  isConfirming?: boolean;
}

/**
 * DepositPreview displays a side‑by‑side "Before / After" view of balances,
 * and when a prepared Soroban transaction summary is provided, displays the
 * decoded contract call details and exact assembled fee before signing.
 */
export default function DepositPreview({
  previewCurrentBalance,
  projectedBalance,
  networkFee,
  amount,
  hasAmount,
  walletBalance,
  ariaLabel = 'Deposit transaction preview',
  txSummary = null,
  isPreparing = false,
  onConfirmSign,
  isConfirming = false,
}: DepositPreviewProps) {
  const { networkFee: horizonNetworkFee, isEstimated: isHorizonEstimated } = useNetworkFee(
    networkFee,
    !txSummary,
  );
  const assembledFee = txSummary ? formatStroops(txSummary.feeStroops) : null;
  const displayedNetworkFee = assembledFee ?? horizonNetworkFee;
  const isEstimated = assembledFee ? false : isHorizonEstimated;
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
            <strong>
              <span>{displayedNetworkFee}</span>
              {isEstimated && <span> (estimated)</span>}
            </strong>
          </li>
          <li className="total">
            <span>Total cost</span>
            <strong>
              {hasAmount
                ? `${formatUsdc(amount)} USDC + ${displayedNetworkFee}`
                : `0 USDC + ${displayedNetworkFee}`}
            </strong>
          </li>
        </ul>
      </div>

      {isPreparing && (
        <p role="status" aria-live="polite">
          Preparing transaction summary...
        </p>
      )}

      {txSummary && (
        <div className="tx-summary-section">
          <TransactionSummaryDetails summary={txSummary} />
          {onConfirmSign && (
            <button
              type="button"
              className="primary-button"
              onClick={onConfirmSign}
              disabled={isPreparing || isConfirming}
            >
              {isConfirming ? 'Approve in wallet...' : 'Confirm & Sign in Freighter'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
