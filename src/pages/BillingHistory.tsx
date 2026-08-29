/**
 * BillingHistory.tsx — Billing transaction history page (GrantFox FWC26).
 *
 * Displays a paginated table of past USDC transactions. Each row carries a
 * hover-triggered (and keyboard-accessible) PreviewCard that reveals on-chain
 * details — transaction hash, network, confirmation count, direction, and
 * precise timestamp — without navigating away from the page.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Table uses <thead> / <tbody> with <th scope="col"> for screen readers.
 * - Each row's PreviewCard trigger has an explicit aria-label and responds to
 *   Escape (dismiss), Tab (move focus), and Enter/Space (open on keyboard-only).
 * - Status badges use the project's pattern-based StatusBadge component so
 *   information is never conveyed by colour alone (WCAG 1.4.1).
 * - A live-region announces when the active filter changes (WCAG 4.1.3).
 * - All colours reference design tokens so both light and dark themes work.
 *
 * Keyboard navigation:
 *   Tab               Move focus between row triggers.
 *   Focus on trigger  Opens the preview card automatically.
 *   Escape            Closes the preview and returns focus to the trigger.
 *   Blur / Tab away   Closes the preview when focus leaves the row.
 */

import { useId, useMemo, useState } from 'react';
import PreviewCard, { type PreviewCardData } from '../components/PreviewCard';
import StatusBadge, { type StatusVariant } from '../components/StatusBadge';
import { formatUsdcAmount, formatDateShort } from '../utils/format';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TxType = 'Deposit' | 'API Call' | 'Refund' | 'Settlement' | 'Fee';
export type TxDirection = 'credit' | 'debit';
export type TxStatus = Extract<StatusVariant, 'success' | 'pending' | 'error' | 'warning'>;

export interface BillingTransaction {
  id: string;
  /** Human-readable description of the transaction. */
  description: string;
  type: TxType;
  direction: TxDirection;
  /** Amount in USDC (positive number). */
  amount: number;
  status: TxStatus;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Full 64-character Stellar transaction hash. */
  txHash: string;
  /** Ledger / network name. */
  network: string;
  /** Number of block/ledger confirmations. */
  confirmations: number;
}

// ── Mock data ─────────────────────────────────────────────────────────────────
// Realistic-looking mock transactions for the GrantFox FWC26 prototype.

export const MOCK_TRANSACTIONS: BillingTransaction[] = [
  {
    id: 'tx-001',
    description: 'USDC vault deposit',
    type: 'Deposit',
    direction: 'credit',
    amount: 100.00,
    status: 'success',
    timestamp: '2026-07-25T14:32:00Z',
    txHash: 'A3F9B2C1D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1',
    network: 'Stellar Mainnet',
    confirmations: 120,
  },
  {
    id: 'tx-002',
    description: 'WeatherSim API · 3 calls',
    type: 'API Call',
    direction: 'debit',
    amount: 0.24,
    status: 'success',
    timestamp: '2026-07-25T15:10:22Z',
    txHash: 'B4G0C3D2E5F6A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B3',
    network: 'Stellar Mainnet',
    confirmations: 98,
  },
  {
    id: 'tx-003',
    description: 'Stellar settlement · Epoch 1047',
    type: 'Settlement',
    direction: 'credit',
    amount: 12.80,
    status: 'success',
    timestamp: '2026-07-26T00:00:00Z',
    txHash: 'C5H1D4E3F6A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5',
    network: 'Stellar Mainnet',
    confirmations: 60,
  },
  {
    id: 'tx-004',
    description: 'Refund · CreditScore API',
    type: 'Refund',
    direction: 'credit',
    amount: 0.05,
    status: 'success',
    timestamp: '2026-07-26T09:17:44Z',
    txHash: 'D6I2E5F4A7B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6',
    network: 'Stellar Mainnet',
    confirmations: 45,
  },
  {
    id: 'tx-005',
    description: 'Network fee · tx D6I2…',
    type: 'Fee',
    direction: 'debit',
    amount: 0.001,
    status: 'success',
    timestamp: '2026-07-26T09:17:44Z',
    txHash: 'E7J3F6A5B8C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7',
    network: 'Stellar Mainnet',
    confirmations: 45,
  },
  {
    id: 'tx-006',
    description: 'USDC vault deposit',
    type: 'Deposit',
    direction: 'credit',
    amount: 50.00,
    status: 'pending',
    timestamp: '2026-07-27T11:04:00Z',
    txHash: 'F8K4A7B6C9D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8',
    network: 'Stellar Mainnet',
    confirmations: 2,
  },
  {
    id: 'tx-007',
    description: 'ChainRisk API · 1 call',
    type: 'API Call',
    direction: 'debit',
    amount: 0.08,
    status: 'error',
    timestamp: '2026-07-27T13:22:10Z',
    txHash: 'G9L5B8C7D0E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9',
    network: 'Stellar Mainnet',
    confirmations: 0,
  },
  {
    id: 'tx-008',
    description: 'MarketFeed API · 10 calls',
    type: 'API Call',
    direction: 'debit',
    amount: 0.80,
    status: 'success',
    timestamp: '2026-07-28T08:55:33Z',
    txHash: 'H0M6C9D8E1F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0',
    network: 'Stellar Mainnet',
    confirmations: 88,
  },
];

// ── Filter & sort helpers ─────────────────────────────────────────────────────

const ALL_TYPES: TxType[] = ['Deposit', 'API Call', 'Refund', 'Settlement', 'Fee'];
const ALL_STATUSES: TxStatus[] = ['success', 'pending', 'error', 'warning'];

function truncateTxHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** Build a PreviewCardData object from a BillingTransaction. */
function txToPreviewData(tx: BillingTransaction): PreviewCardData {
  return {
    id: tx.id,
    title: tx.description,
    status: tx.status,
    type: tx.type,
    direction: tx.direction,
    amount: tx.amount,
    txHash: tx.txHash,
    network: tx.network,
    confirmations: tx.confirmations,
    timestamp: tx.timestamp,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BillingHistory() {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<TxType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<TxStatus | 'All'>('All');
  const [directionFilter, setDirectionFilter] = useState<TxDirection | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Live-region ID for filter-change announcements.
  const liveRegionId = useId();

  // Build a human-readable description of the active filters for the live region.
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (typeFilter !== 'All') parts.push(`type: ${typeFilter}`);
    if (statusFilter !== 'All') parts.push(`status: ${statusFilter}`);
    if (directionFilter !== 'All') parts.push(`direction: ${directionFilter}`);
    if (searchQuery.trim()) parts.push(`search: "${searchQuery}"`);
    return parts.length === 0 ? 'Showing all transactions' : `Filtered by ${parts.join(', ')}`;
  }, [typeFilter, statusFilter, directionFilter, searchQuery]);

  // ── Derived filtered/sorted list ──────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    return MOCK_TRANSACTIONS.filter((tx) => {
      if (typeFilter !== 'All' && tx.type !== typeFilter) return false;
      if (statusFilter !== 'All' && tx.status !== statusFilter) return false;
      if (directionFilter !== 'All' && tx.direction !== directionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.txHash.toLowerCase().includes(q) ||
          tx.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [typeFilter, statusFilter, directionFilter, searchQuery]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const netBalance = useMemo(() => {
    return filteredTxs.reduce(
      (sum, tx) => sum + (tx.direction === 'credit' ? tx.amount : -tx.amount),
      0,
    );
  }, [filteredTxs]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      className="billing-history"
      aria-labelledby="bh-page-title"
      style={{
        padding: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      {/* Page heading */}
      <header style={{ marginBottom: '20px' }}>
        <p className="eyebrow" style={{ marginBottom: '4px' }}>
          GrantFox FWC26
        </p>
        <h1
          id="bh-page-title"
          style={{
            fontSize: 'clamp(1.35rem, 3vw, 1.75rem)',
            fontWeight: 700,
            margin: '0 0 6px',
            color: 'var(--text-primary, var(--text, #f9fafb))',
          }}
        >
          Billing History
        </h1>
        <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '0.875rem', margin: 0 }}>
          Hover or focus any transaction row to preview on-chain details. Press{' '}
          <kbd
            style={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              padding: '1px 4px',
              borderRadius: '3px',
              border: '1px solid var(--line, rgba(255,255,255,0.15))',
            }}
          >
            Esc
          </kbd>{' '}
          to dismiss the preview.
        </p>
      </header>

      {/* Live region for filter changes (WCAG 4.1.3) */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {filterSummary}
      </div>

      {/* ── Filters bar ─────────────────────────────────────────────────── */}
      <div
        className="bh-filters"
        role="group"
        aria-label="Transaction filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 180px' }}>
          <span
            style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #9ca3af)', fontWeight: 600 }}
          >
            Search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Description or hash…"
            aria-label="Search transactions by description or hash"
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid var(--line, rgba(255,255,255,0.15))',
              background: 'var(--bg-chip, rgba(255,255,255,0.04))',
              color: 'var(--text-primary, #f9fafb)',
              fontSize: '0.8125rem',
            }}
          />
        </label>

        {/* Type filter */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #9ca3af)', fontWeight: 600 }}
          >
            Type
          </span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TxType | 'All')}
            aria-label="Filter by transaction type"
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid var(--line, rgba(255,255,255,0.15))',
              background: 'var(--bg-chip, rgba(255,255,255,0.04))',
              color: 'var(--text-primary, #f9fafb)',
              fontSize: '0.8125rem',
            }}
          >
            <option value="All">All types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        {/* Status filter */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #9ca3af)', fontWeight: 600 }}
          >
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TxStatus | 'All')}
            aria-label="Filter by transaction status"
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid var(--line, rgba(255,255,255,0.15))',
              background: 'var(--bg-chip, rgba(255,255,255,0.04))',
              color: 'var(--text-primary, #f9fafb)',
              fontSize: '0.8125rem',
            }}
          >
            <option value="All">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Direction filter */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #9ca3af)', fontWeight: 600 }}
          >
            Direction
          </span>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as TxDirection | 'All')}
            aria-label="Filter by transaction direction"
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid var(--line, rgba(255,255,255,0.15))',
              background: 'var(--bg-chip, rgba(255,255,255,0.04))',
              color: 'var(--text-primary, #f9fafb)',
              fontSize: '0.8125rem',
            }}
          >
            <option value="All">All directions</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </label>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          fontSize: '0.8125rem',
          color: 'var(--text-secondary, #9ca3af)',
        }}
      >
        <span>
          {filteredTxs.length} transaction{filteredTxs.length !== 1 ? 's' : ''}
        </span>
        <span>
          Net:{' '}
          <strong
            className="tabular-nums"
            style={{
              color:
                netBalance > 0
                  ? 'var(--success, #10b981)'
                  : netBalance < 0
                    ? 'var(--danger, #ef4444)'
                    : 'var(--text-primary, #f9fafb)',
            }}
          >
            {netBalance >= 0 ? '+' : '−'}
            {formatUsdcAmount(Math.abs(netBalance))} USDC
          </strong>
        </span>
      </div>

      {/* ── Transaction table ─────────────────────────────────────────────── */}
      {filteredTxs.length === 0 ? (
        <div
          role="status"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            color: 'var(--text-secondary, #9ca3af)',
            borderRadius: '10px',
            border: '1px dashed var(--line, rgba(255,255,255,0.1))',
          }}
        >
          No transactions match the current filters.
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            borderRadius: '10px',
            border: '1px solid var(--line, rgba(255,255,255,0.08))',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8125rem',
            }}
            aria-label="Billing transaction history"
          >
            <thead>
              <tr
                style={{
                  background: 'var(--bg-chip, rgba(255,255,255,0.03))',
                  borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))',
                }}
              >
                {(
                  [
                    { label: 'Date', width: '160px' },
                    { label: 'Description', width: 'auto' },
                    { label: 'Type', width: '110px' },
                    { label: 'Status', width: '110px' },
                    { label: 'Amount (USDC)', width: '130px' },
                    { label: 'Tx Hash', width: '110px' },
                  ] as const
                ).map(({ label, width }) => (
                  <th
                    key={label}
                    scope="col"
                    style={{
                      padding: '10px 12px',
                      textAlign: label === 'Amount (USDC)' ? 'right' : 'left',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #9ca3af)',
                      whiteSpace: 'nowrap',
                      width,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredTxs.map((tx, idx) => (
                <tr
                  key={tx.id}
                  data-testid={`bh-row-${tx.id}`}
                  style={{
                    borderBottom:
                      idx < filteredTxs.length - 1
                        ? '1px solid var(--line, rgba(255,255,255,0.05))'
                        : 'none',
                  }}
                >
                  {/* Date cell */}
                  <td
                    style={{
                      padding: '10px 12px',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-secondary, #9ca3af)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <time dateTime={tx.timestamp}>{formatDateShort(tx.timestamp)}</time>
                  </td>

                  {/* Description cell — wraps the PreviewCard trigger */}
                  <td style={{ padding: '10px 12px' }}>
                    <PreviewCard
                      data={txToPreviewData(tx)}
                      position="bottom"
                    >
                      <span
                        style={{
                          color: 'var(--text-primary, #f9fafb)',
                          fontWeight: 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {/* Direction indicator */}
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: '0.75rem',
                            color:
                              tx.direction === 'credit'
                                ? 'var(--success, #10b981)'
                                : 'var(--danger, #ef4444)',
                          }}
                        >
                          {tx.direction === 'credit' ? '↑' : '↓'}
                        </span>
                        {tx.description}
                      </span>
                    </PreviewCard>
                  </td>

                  {/* Type cell */}
                  <td
                    style={{
                      padding: '10px 12px',
                      color: 'var(--text-secondary, #9ca3af)',
                    }}
                  >
                    {tx.type}
                  </td>

                  {/* Status cell */}
                  <td style={{ padding: '10px 12px' }}>
                    <StatusBadge status={tx.status} />
                  </td>

                  {/* Amount cell */}
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                    className="tabular-nums"
                  >
                    <span
                      style={{
                        color:
                          tx.direction === 'credit'
                            ? 'var(--success, #10b981)'
                            : 'var(--danger, #ef4444)',
                      }}
                    >
                      {tx.direction === 'credit' ? '+' : '−'}
                      {formatUsdcAmount(tx.amount)}
                    </span>
                  </td>

                  {/* Tx hash cell */}
                  <td
                    style={{
                      padding: '10px 12px',
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      color: 'var(--accent, #6366f1)',
                    }}
                  >
                    <code title={tx.txHash}>{truncateTxHash(tx.txHash)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Accessible keyboard tip ──────────────────────────────────────── */}
      <p
        style={{
          marginTop: '14px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary, #6b7280)',
        }}
      >
        <strong>Keyboard tip:</strong> Tab to a transaction description to open its preview.
        Press{' '}
        <kbd
          style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            padding: '1px 4px',
            borderRadius: '3px',
            border: '1px solid var(--line, rgba(255,255,255,0.15))',
          }}
        >
          Esc
        </kbd>{' '}
        to close it and return focus to that row.
      </p>
    </section>
  );
}

export default BillingHistory;
