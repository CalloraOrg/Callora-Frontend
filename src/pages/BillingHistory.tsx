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

import { useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PreviewCard, { type PreviewCardData } from '../components/PreviewCard';
import StatusBadge, { type StatusVariant } from '../components/StatusBadge';
import { formatUsdcAmount, formatDateShort, resolveTimeZone } from '../utils/format';
import { useAccountContext } from '../hooks/useAccountContext';
import './BillingHistory.css';
import TransactionCard from '../components/TransactionCard';
import { useMediaQuery } from '../hooks/useMediaQuery';
import BottomSheet from '../components/BottomSheet';
import { TransactionDetails } from '../components/TransactionDetails';
import BillingSortSelect from '../components/BillingSortSelect';

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


/** Transaction-oriented wording (the badge defaults describe service health). */
const TX_STATUS_LABELS: Record<TxStatus, string> = {
  success: 'Confirmed',
  pending: 'Pending',
  error: 'Failed',
  warning: 'Needs review',
};
const ALL_TYPES: TxType[] = ['Deposit', 'API Call', 'Refund', 'Settlement', 'Fee'];
const ALL_STATUSES: TxStatus[] = ['success', 'pending', 'error', 'warning'];

/** Below this width transactions render as cards instead of a table. */
const MOBILE_QUERY = '(max-width: 639px)';

// Valid URL parameter values for sort column and direction.
export type SortColumn = 'date' | 'amount';
export type SortDirection = 'asc' | 'desc';

const VALID_SORT_COLUMNS: ReadonlySet<string> = new Set<SortColumn>(['date', 'amount']);
const VALID_SORT_DIRS: ReadonlySet<string> = new Set<SortDirection>(['asc', 'desc']);

/** Parse sort params from a URLSearchParams, returning null for invalid/missing values. */
function parseSortParams(params: URLSearchParams): {
  column: SortColumn | null;
  direction: SortDirection;
} {
  const col = params.get('sort');
  const dir = params.get('dir');
  return {
    column: col && VALID_SORT_COLUMNS.has(col) ? (col as SortColumn) : null,
    direction: dir && VALID_SORT_DIRS.has(dir) ? (dir as SortDirection) : 'asc',
  };
}

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
  const { timezone } = useAccountContext();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [selectedTx, setSelectedTx] = useState<BillingTransaction | null>(null);
  const detailsTriggerRef = useRef<HTMLElement | null>(null);
  const openDetails = (tx: BillingTransaction, trigger: HTMLButtonElement) => {
    detailsTriggerRef.current = trigger;
    setSelectedTx(tx);
  };
  const dateZone = resolveTimeZone(timezone);
  const zoneAbbreviation = new Intl.DateTimeFormat(undefined, {
    timeZone: dateZone,
    timeZoneName: 'short',
  }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value;
  // Header suffix, e.g. "EDT"; falls back to the IANA zone name.
  const dateZoneLabel = zoneAbbreviation ?? dateZone;
  // ── Filter state ──────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<TxType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<TxStatus | 'All'>('All');
  const [directionFilter, setDirectionFilter] = useState<TxDirection | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Sort state (URL-persisted) ────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const { column: sortColumn, direction: sortDirection } = parseSortParams(searchParams);

  /** Write an explicit sort to the URL (shared by the column headers and the mobile select). */
  function applySort(col: SortColumn, dir: SortDirection) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('sort', col);
        next.set('dir', dir);
        return next;
      },
      { replace: true },
    );
  }

  /** Toggle sort: same column flips direction; new column starts asc. */
  function handleSort(col: SortColumn) {
    applySort(col, sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc');
  }

  /** aria-sort value for a given column header. */
  function ariaSortFor(col: SortColumn): React.AriaAttributes['aria-sort'] {
    if (sortColumn !== col) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  }

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
    const filtered = MOCK_TRANSACTIONS.filter((tx) => {
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

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'date') {
        cmp = a.timestamp.localeCompare(b.timestamp);
      } else {
        // amount
        cmp = a.amount - b.amount;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [typeFilter, statusFilter, directionFilter, searchQuery, sortColumn, sortDirection]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const netBalance = useMemo(() => {
    return filteredTxs.reduce(
      (sum, tx) => sum + (tx.direction === 'credit' ? tx.amount : -tx.amount),
      0,
    );
  }, [filteredTxs]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="billing-history bh-page" aria-labelledby="bh-page-title">
      {/* Page heading */}
      <header className="bh-header">
        <p className="eyebrow">Billing</p>
        <h1 id="bh-page-title" className="bh-title">
          Billing History
        </h1>
        <p className="bh-subtitle">
          Hover or focus any transaction row to preview on-chain details. Press{' '}
          <kbd className="bh-kbd">Esc</kbd>{' '}
          to dismiss the preview.
        </p>
      </header>

      {/* Live region for filter changes (WCAG 4.1.3) */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="bh-visually-hidden"
      >
        {filterSummary}
      </div>

      {/* ── Filters bar ─────────────────────────────────────────────────── */}
      <div className="bh-filters" role="group" aria-label="Transaction filters">
        {/* Search */}
        <label className="bh-field bh-field--grow">
          <span className="bh-field__label">Search</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Description or hash…"
            aria-label="Search transactions by description or hash"
            className="bh-field__control"
          />
        </label>

        {/* Type filter */}
        <label className="bh-field">
          <span className="bh-field__label">Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TxType | 'All')}
            aria-label="Filter by transaction type"
            className="bh-field__control"
          >
            <option value="All">All types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        {/* Status filter */}
        <label className="bh-field">
          <span className="bh-field__label">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TxStatus | 'All')}
            aria-label="Filter by transaction status"
            className="bh-field__control"
          >
            <option value="All">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Direction filter */}
        <label className="bh-field">
          <span className="bh-field__label">Direction</span>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as TxDirection | 'All')}
            aria-label="Filter by transaction direction"
            className="bh-field__control"
          >
            <option value="All">All directions</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </label>
        {isMobile && (
          <BillingSortSelect column={sortColumn} direction={sortDirection} onChange={applySort} />
        )}
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div className="bh-summary">
        <span>
          {filteredTxs.length} transaction{filteredTxs.length !== 1 ? 's' : ''}
        </span>
        <span>
          Net:{' '}
          <strong
            className={`tabular-nums ${
              netBalance > 0
                ? 'bh-net--positive'
                : netBalance < 0
                  ? 'bh-net--negative'
                  : 'bh-net--zero'
            }`}
          >
            {netBalance >= 0 ? '+' : '−'}
            {formatUsdcAmount(Math.abs(netBalance))} USDC
          </strong>
        </span>
      </div>

      {/* ── Transaction table ─────────────────────────────────────────────── */}
      {filteredTxs.length === 0 ? (
        <div role="status" className="bh-empty">
          No transactions match the current filters.
        </div>
      ) : isMobile ? (
        <ul className="bh-card-list" aria-label="Billing transactions">
          {filteredTxs.map((tx) => (
            <TransactionCard
              key={tx.id}
              tx={tx}
              dateText={formatDateShort(tx.timestamp, undefined, dateZone)}
              statusLabel={TX_STATUS_LABELS[tx.status]}
              onDetails={openDetails}
            />
          ))}
        </ul>
      ) : (
        <div className="bh-table-wrap">
          <table className="bh-table" aria-label="Billing transaction history"
          >
            <thead>
              <tr className="bh-table__head-row">
                {/* Date — sortable */}
                <th
                  scope="col"
                  aria-sort={ariaSortFor('date')} className="bh-th bh-th--date">
                  <button
                    type="button"
                    onClick={() => handleSort('date')}
                    aria-label={
                      sortColumn === 'date'
                        ? `Date (${dateZoneLabel}), sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Activate to reverse.`
                        : `Date (${dateZoneLabel}). Activate to sort ascending.`
                    } className={'bh-sort-btn' + (sortColumn === 'date' ? ' bh-sort-btn--active' : '')}
                  >
                    Date ({dateZoneLabel})
                    <span aria-hidden="true" className="bh-sort-icon">
                      {sortColumn === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                </th>

                {/* Description — not sortable */}
                <th
                  scope="col" className="bh-th bh-th--description">
                  Description
                </th>

                {/* Type — not sortable */}
                <th
                  scope="col" className="bh-th bh-th--narrow">
                  Type
                </th>

                {/* Status — not sortable */}
                <th
                  scope="col" className="bh-th bh-th--narrow">
                  Status
                </th>

                {/* Amount — sortable */}
                <th
                  scope="col"
                  aria-sort={ariaSortFor('amount')} className="bh-th bh-th--amount">
                  <button
                    type="button"
                    onClick={() => handleSort('amount')}
                    aria-label={
                      sortColumn === 'amount'
                        ? `Amount, sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}. Activate to reverse.`
                        : 'Amount. Activate to sort ascending.'
                    } className={'bh-sort-btn' + (sortColumn === 'amount' ? ' bh-sort-btn--active' : '')}
                  >
                    Amount (USDC)
                    <span aria-hidden="true" className="bh-sort-icon">
                      {sortColumn === 'amount' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                </th>

                {/* Tx Hash — not sortable */}
                <th
                  scope="col" className="bh-th bh-th--narrow">
                  Tx Hash
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTxs.map((tx) => (
                <tr
                  key={tx.id}
                  data-testid={`bh-row-${tx.id}`}
                >
                  {/* Date cell */}
                  <td className="bh-td bh-td--date">
                    <time dateTime={tx.timestamp}>{formatDateShort(tx.timestamp, undefined, dateZone)}</time>
                  </td>

                  {/* Description cell — wraps the PreviewCard trigger */}
                  <td className="bh-td">
                    <PreviewCard
                      data={txToPreviewData(tx)}
                      position="bottom"
                    >
                      <span className="bh-description">
                        {/* Direction indicator */}
                        <span aria-hidden="true" className={"bh-direction-icon bh-tone--" + tx.direction}>
                          {tx.direction === 'credit' ? '↑' : '↓'}
                        </span>
                        {tx.description}
                      </span>
                    </PreviewCard>
                  </td>

                  {/* Type cell */}
                  <td className="bh-td bh-td--type">
                    {tx.type}
                  </td>

                  {/* Status cell */}
                  <td className="bh-td">
                    <StatusBadge status={tx.status} label={TX_STATUS_LABELS[tx.status]} />
                  </td>

                  {/* Amount cell */}
                  <td className="bh-td bh-td--amount tabular-nums">
                    <span className={"bh-tone--" + tx.direction}>
                      {tx.direction === 'credit' ? '+' : '−'}
                      {formatUsdcAmount(tx.amount)}
                    </span>
                  </td>

                  {/* Tx hash cell */}
                  <td className="bh-td bh-td--hash">
                    <code title={tx.txHash}>{truncateTxHash(tx.txHash)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Accessible keyboard tip ──────────────────────────────────────── */}
      <p className="bh-tip">
        <strong>Keyboard tip:</strong> Tab to a transaction description to open its preview.
        Press{' '}
        <kbd className="bh-kbd">Esc</kbd>{' '}
        to close it and return focus to that row.
      </p>
      <BottomSheet
        open={isMobile && selectedTx !== null}
        onClose={() => setSelectedTx(null)}
        title={selectedTx ? `${selectedTx.description} details` : 'Transaction details'}
        triggerRef={detailsTriggerRef}
      >
        {selectedTx && <TransactionDetails data={txToPreviewData(selectedTx)} />}
      </BottomSheet>
    </section>
  );
}

export default BillingHistory;
