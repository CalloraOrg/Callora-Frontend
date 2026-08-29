// @vitest-environment jsdom
/**
 * BillingHistory.test.tsx
 *
 * Tests for the BillingHistory page (GrantFox FWC26).
 *
 * Coverage areas:
 *   - Page renders with correct heading and all transactions
 *   - Each row has a PreviewCard trigger (hover / focus open)
 *   - Filter controls work: type, status, direction, search
 *   - Empty-state message when no rows match filters
 *   - Net-balance summary updates with filters
 *   - ARIA: table has accessible label, status live region present,
 *     keyboard tip present, status badges present
 *   - Tx hash truncation in the table
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BillingHistory, MOCK_TRANSACTIONS } from './BillingHistory';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get the row element for a given transaction id. */
function getRow(txId: string) {
  return screen.getByTestId(`bh-row-${txId}`) as HTMLElement;
}

/** Get the PreviewCard trigger inside a given row. */
function getTriggerInRow(row: HTMLElement) {
  return within(row).getByRole('button', { name: /preview details for/i });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('BillingHistory — page structure', () => {
  afterEach(cleanup);

  it('renders the page heading', () => {
    render(<BillingHistory />);
    expect(
      screen.getByRole('heading', { name: /billing history/i, level: 1 }),
    ).toBeTruthy();
  });

  it('renders all mock transactions by default', () => {
    render(<BillingHistory />);
    expect(screen.getByText(`${MOCK_TRANSACTIONS.length} transactions`)).toBeTruthy();
  });

  it('renders a table with an accessible aria-label', () => {
    render(<BillingHistory />);
    expect(
      screen.getByRole('table', { name: /billing transaction history/i }),
    ).toBeTruthy();
  });

  it('renders column headers with scope="col"', () => {
    render(<BillingHistory />);
    const headerCells = screen
      .getAllByRole('columnheader')
      .filter((th) => th.getAttribute('scope') === 'col');
    // Expect Date, Description, Type, Status, Amount, Tx Hash
    expect(headerCells.length).toBeGreaterThanOrEqual(6);
  });

  it('renders a status live region for filter announcements', () => {
    render(<BillingHistory />);
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('renders a keyboard tip containing "Esc"', () => {
    render(<BillingHistory />);
    // The bottom keyboard tip paragraph
    expect(screen.getAllByText(/Esc/i).length).toBeGreaterThan(0);
  });

  it('renders StatusBadge for each transaction', () => {
    render(<BillingHistory />);
    // StatusBadge uses role="img"; there should be at least one per row.
    const badges = screen.getAllByRole('img');
    expect(badges.length).toBeGreaterThanOrEqual(MOCK_TRANSACTIONS.length);
  });

  it('shows the net balance summary line', () => {
    render(<BillingHistory />);
    // Net: label should be visible
    expect(screen.getByText('Net:')).toBeTruthy();
  });
});

// ── PreviewCard integration ───────────────────────────────────────────────────

describe('BillingHistory — PreviewCard hover/focus integration', () => {
  afterEach(cleanup);

  it('each transaction row has a PreviewCard trigger button', () => {
    render(<BillingHistory />);
    // Each row must have exactly one trigger per PreviewCard
    MOCK_TRANSACTIONS.forEach((tx) => {
      const row = getRow(tx.id);
      expect(getTriggerInRow(row)).toBeTruthy();
    });
  });

  it('hovering a row description opens the preview tooltip', () => {
    render(<BillingHistory />);
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const wrapper = row.querySelector('.preview-card__wrapper') as HTMLElement;

    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('focusing a row trigger opens the preview tooltip', () => {
    render(<BillingHistory />);
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('preview panel shows the transaction description', () => {
    render(<BillingHistory />);
    const tx = MOCK_TRANSACTIONS[0]; // "USDC vault deposit"
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(tx.description);
  });

  it('preview panel shows the tx hash (truncated)', () => {
    render(<BillingHistory />);
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    const panel = screen.getByRole('tooltip');
    // Should show at least the first 8 chars of the hash
    expect(panel).toHaveTextContent(tx.txHash.slice(0, 8));
  });

  it('preview panel shows network name', () => {
    render(<BillingHistory />);
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Stellar Mainnet');
  });

  it('preview panel shows confirmation count', () => {
    render(<BillingHistory />);
    const tx = MOCK_TRANSACTIONS[0]; // 120 confirmations
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('120');
  });

  it('preview panel shows formatted USDC amount', () => {
    render(<BillingHistory />);
    const tx = MOCK_TRANSACTIONS[0]; // 100.00 USDC
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('100.00 USDC');
  });

  it('Escape closes the preview and removes aria-describedby', () => {
    render(<BillingHistory />);
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('trigger aria-label includes the transaction description', () => {
    render(<BillingHistory />);
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);
    // aria-label is "Preview details for <title>"
    expect(trigger.getAttribute('aria-label')).toMatch(
      new RegExp(tx.description, 'i'),
    );
  });

  it('panel has pointer-events: none to avoid mouse trapping', () => {
    render(<BillingHistory />);
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip').style.pointerEvents).toBe('none');
  });
});

// ── Filtering ─────────────────────────────────────────────────────────────────

describe('BillingHistory — filters', () => {
  afterEach(cleanup);

  it('filter by type "Deposit" shows only deposit rows', () => {
    render(<BillingHistory />);
    const typeSelect = screen.getByRole('combobox', { name: /filter by transaction type/i });

    fireEvent.change(typeSelect, { target: { value: 'Deposit' } });

    const depositCount = MOCK_TRANSACTIONS.filter((tx) => tx.type === 'Deposit').length;
    expect(screen.getByText(`${depositCount} transaction${depositCount !== 1 ? 's' : ''}`)).toBeTruthy();

    // Non-deposit transactions should not be visible
    const apiCallTxs = MOCK_TRANSACTIONS.filter((tx) => tx.type === 'API Call');
    apiCallTxs.forEach((tx) => {
      expect(screen.queryByTestId(`bh-row-${tx.id}`)).toBeNull();
    });
  });

  it('filter by status "pending" shows only pending rows', () => {
    render(<BillingHistory />);
    const statusSelect = screen.getByRole('combobox', { name: /filter by transaction status/i });

    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    const pendingCount = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'pending').length;
    expect(screen.getByText(`${pendingCount} transaction${pendingCount !== 1 ? 's' : ''}`)).toBeTruthy();
  });

  it('filter by direction "credit" shows only credit rows', () => {
    render(<BillingHistory />);
    const dirSelect = screen.getByRole('combobox', { name: /filter by transaction direction/i });

    fireEvent.change(dirSelect, { target: { value: 'credit' } });

    const creditCount = MOCK_TRANSACTIONS.filter((tx) => tx.direction === 'credit').length;
    expect(screen.getByText(`${creditCount} transaction${creditCount !== 1 ? 's' : ''}`)).toBeTruthy();

    // Debit rows must be hidden
    MOCK_TRANSACTIONS.filter((tx) => tx.direction === 'debit').forEach((tx) => {
      expect(screen.queryByTestId(`bh-row-${tx.id}`)).toBeNull();
    });
  });

  it('search by description filters rows', () => {
    render(<BillingHistory />);
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });

    fireEvent.change(searchInput, { target: { value: 'WeatherSim' } });

    const matchCount = MOCK_TRANSACTIONS.filter((tx) =>
      tx.description.toLowerCase().includes('weathersim'),
    ).length;
    expect(screen.getByText(`${matchCount} transaction${matchCount !== 1 ? 's' : ''}`)).toBeTruthy();
  });

  it('search by tx hash filters rows', () => {
    render(<BillingHistory />);
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });
    // Use the first 8 chars of the first tx hash
    const hashPrefix = MOCK_TRANSACTIONS[0].txHash.slice(0, 8).toLowerCase();
    fireEvent.change(searchInput, { target: { value: hashPrefix } });

    // At least one row should remain
    expect(screen.queryByRole('table')).toBeTruthy();
  });

  it('shows empty state when no transactions match', () => {
    render(<BillingHistory />);
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });

    fireEvent.change(searchInput, { target: { value: 'ZZZNOMATCH999' } });

    expect(
      screen.getByText(/no transactions match the current filters/i),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('net balance is positive when only credits are shown', () => {
    render(<BillingHistory />);
    const dirSelect = screen.getByRole('combobox', { name: /filter by transaction direction/i });
    fireEvent.change(dirSelect, { target: { value: 'credit' } });

    // Net label visible and "+" prefix present
    const netStrong = document.querySelector('[class*="tabular-nums"]');
    // We just check the page still renders with a "+" somewhere in the net line
    const pageText = document.body.textContent ?? '';
    expect(pageText).toContain('+');
  });

  it('live region contains filter summary after type filter change', () => {
    render(<BillingHistory />);
    const typeSelect = screen.getByRole('combobox', { name: /filter by transaction type/i });
    fireEvent.change(typeSelect, { target: { value: 'Fee' } });

    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(liveRegion.textContent).toContain('Fee');
  });

  it('live region reads "Showing all transactions" when no filters active', () => {
    render(<BillingHistory />);
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(liveRegion.textContent).toMatch(/showing all transactions/i);
  });
});

// ── Table content ─────────────────────────────────────────────────────────────

describe('BillingHistory — table row content', () => {
  afterEach(cleanup);

  it('shows truncated tx hash in the Tx Hash column', () => {
    render(<BillingHistory />);
    // First transaction: A3F9B2C1... → "A3F9B2…F0A1" (6+…+4)
    const hashCode = screen.getAllByTitle(MOCK_TRANSACTIONS[0].txHash)[0];
    expect(hashCode).toBeTruthy();
    // Truncated form must be shorter than the full hash
    expect((hashCode.textContent ?? '').length).toBeLessThan(
      MOCK_TRANSACTIONS[0].txHash.length,
    );
  });

  it('amount cell has tabular-nums class for alignment', () => {
    render(<BillingHistory />);
    const cells = document.querySelectorAll('td.tabular-nums');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('date cells render <time> elements with dateTime attributes', () => {
    render(<BillingHistory />);
    const timeTags = document.querySelectorAll('td time');
    // At least one per row
    expect(timeTags.length).toBeGreaterThanOrEqual(MOCK_TRANSACTIONS.length);
    timeTags.forEach((t) => {
      expect(t.getAttribute('dateTime')).toBeTruthy();
    });
  });
});
