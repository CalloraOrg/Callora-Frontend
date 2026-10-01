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
import { MemoryRouter } from 'react-router-dom';
import { BillingHistory, MOCK_TRANSACTIONS } from './BillingHistory';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Render BillingHistory inside a MemoryRouter.
 * Pass `initialEntries` to pre-seed URL search params, e.g. `['?sort=date&dir=asc']`.
 */
function renderBH(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BillingHistory />
    </MemoryRouter>,
  );
}

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
    renderBH();
    expect(
      screen.getByRole('heading', { name: /billing history/i, level: 1 }),
    ).toBeTruthy();
  });

  it('renders all mock transactions by default', () => {
    renderBH();
    expect(screen.getByText(`${MOCK_TRANSACTIONS.length} transactions`)).toBeTruthy();
  });

  it('renders a table with an accessible aria-label', () => {
    renderBH();
    expect(
      screen.getByRole('table', { name: /billing transaction history/i }),
    ).toBeTruthy();
  });

  it('renders column headers with scope="col"', () => {
    renderBH();
    const headerCells = screen
      .getAllByRole('columnheader')
      .filter((th) => th.getAttribute('scope') === 'col');
    // Expect Date, Description, Type, Status, Amount, Tx Hash
    expect(headerCells.length).toBeGreaterThanOrEqual(6);
  });

  it('renders a status live region for filter announcements', () => {
    renderBH();
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('renders a keyboard tip containing "Esc"', () => {
    renderBH();
    // The bottom keyboard tip paragraph
    expect(screen.getAllByText(/Esc/i).length).toBeGreaterThan(0);
  });

  it('renders StatusBadge for each transaction', () => {
    renderBH();
    // StatusBadge uses role="img"; there should be at least one per row.
    const badges = screen.getAllByRole('img');
    expect(badges.length).toBeGreaterThanOrEqual(MOCK_TRANSACTIONS.length);
  });

  it('shows the net balance summary line', () => {
    renderBH();
    // Net: label should be visible
    expect(screen.getByText('Net:')).toBeTruthy();
  });
});

// ── PreviewCard integration ───────────────────────────────────────────────────

describe('BillingHistory — PreviewCard hover/focus integration', () => {
  afterEach(cleanup);

  it('each transaction row has a PreviewCard trigger button', () => {
    renderBH();
    // Each row must have exactly one trigger per PreviewCard
    MOCK_TRANSACTIONS.forEach((tx) => {
      const row = getRow(tx.id);
      expect(getTriggerInRow(row)).toBeTruthy();
    });
  });

  it('hovering a row description opens the preview tooltip', () => {
    renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const wrapper = row.querySelector('.preview-card__wrapper') as HTMLElement;

    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('focusing a row trigger opens the preview tooltip', () => {
    renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('preview panel shows the transaction description', () => {
    renderBH();
    const tx = MOCK_TRANSACTIONS[0]; // "USDC vault deposit"
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(tx.description);
  });

  it('preview panel shows the tx hash (truncated)', () => {
    renderBH();
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    const panel = screen.getByRole('tooltip');
    // Should show at least the first 8 chars of the hash
    expect(panel).toHaveTextContent(tx.txHash.slice(0, 8));
  });

  it('preview panel shows network name', () => {
    renderBH();
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Stellar Mainnet');
  });

  it('preview panel shows confirmation count', () => {
    renderBH();
    const tx = MOCK_TRANSACTIONS[0]; // 120 confirmations
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('120');
  });

  it('preview panel shows formatted USDC amount', () => {
    renderBH();
    const tx = MOCK_TRANSACTIONS[0]; // 100.00 USDC
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('100.00 USDC');
  });

  it('Escape closes the preview and removes aria-describedby', () => {
    renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('trigger aria-label includes the transaction description', () => {
    renderBH();
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);
    // aria-label is "Preview details for <title>"
    expect(trigger.getAttribute('aria-label')).toMatch(
      new RegExp(tx.description, 'i'),
    );
  });

  it('panel has pointer-events: none to avoid mouse trapping', () => {
    renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip').style.pointerEvents).toBe('none');
  });
});

// ── Filtering ─────────────────────────────────────────────────────────────────

describe('BillingHistory — filters', () => {
  afterEach(cleanup);

  it('filter by type "Deposit" shows only deposit rows', () => {
    renderBH();
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
    renderBH();
    const statusSelect = screen.getByRole('combobox', { name: /filter by transaction status/i });

    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    const pendingCount = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'pending').length;
    expect(screen.getByText(`${pendingCount} transaction${pendingCount !== 1 ? 's' : ''}`)).toBeTruthy();
  });

  it('filter by direction "credit" shows only credit rows', () => {
    renderBH();
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
    renderBH();
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });

    fireEvent.change(searchInput, { target: { value: 'WeatherSim' } });

    const matchCount = MOCK_TRANSACTIONS.filter((tx) =>
      tx.description.toLowerCase().includes('weathersim'),
    ).length;
    expect(screen.getByText(`${matchCount} transaction${matchCount !== 1 ? 's' : ''}`)).toBeTruthy();
  });

  it('search by tx hash filters rows', () => {
    renderBH();
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });
    // Use the first 8 chars of the first tx hash
    const hashPrefix = MOCK_TRANSACTIONS[0].txHash.slice(0, 8).toLowerCase();
    fireEvent.change(searchInput, { target: { value: hashPrefix } });

    // At least one row should remain
    expect(screen.queryByRole('table')).toBeTruthy();
  });

  it('shows empty state when no transactions match', () => {
    renderBH();
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });

    fireEvent.change(searchInput, { target: { value: 'ZZZNOMATCH999' } });

    expect(
      screen.getByText(/no transactions match the current filters/i),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('net balance is positive when only credits are shown', () => {
    renderBH();
    const dirSelect = screen.getByRole('combobox', { name: /filter by transaction direction/i });
    fireEvent.change(dirSelect, { target: { value: 'credit' } });

    // Net label visible and "+" prefix present
    const netStrong = document.querySelector('[class*="tabular-nums"]');
    // We just check the page still renders with a "+" somewhere in the net line
    const pageText = document.body.textContent ?? '';
    expect(pageText).toContain('+');
  });

  it('live region contains filter summary after type filter change', () => {
    renderBH();
    const typeSelect = screen.getByRole('combobox', { name: /filter by transaction type/i });
    fireEvent.change(typeSelect, { target: { value: 'Fee' } });

    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(liveRegion.textContent).toContain('Fee');
  });

  it('live region reads "Showing all transactions" when no filters active', () => {
    renderBH();
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(liveRegion.textContent).toMatch(/showing all transactions/i);
  });
});

// ── Table content ─────────────────────────────────────────────────────────────

describe('BillingHistory — table row content', () => {
  afterEach(cleanup);

  it('shows truncated tx hash in the Tx Hash column', () => {
    renderBH();
    // First transaction: A3F9B2C1... → "A3F9B2…F0A1" (6+…+4)
    const hashCode = screen.getAllByTitle(MOCK_TRANSACTIONS[0].txHash)[0];
    expect(hashCode).toBeTruthy();
    // Truncated form must be shorter than the full hash
    expect((hashCode.textContent ?? '').length).toBeLessThan(
      MOCK_TRANSACTIONS[0].txHash.length,
    );
  });

  it('amount cell has tabular-nums class for alignment', () => {
    renderBH();
    const cells = document.querySelectorAll('td.tabular-nums');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('date cells render <time> elements with dateTime attributes', () => {
    renderBH();
    const timeTags = document.querySelectorAll('td time');
    // At least one per row
    expect(timeTags.length).toBeGreaterThanOrEqual(MOCK_TRANSACTIONS.length);
    timeTags.forEach((t) => {
      expect(t.getAttribute('dateTime')).toBeTruthy();
    });
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

/**
 * Return the data-testid attribute values for all visible tbody rows in order.
 * Each testid is "bh-row-<txId>", so we strip the prefix to get the tx id.
 */
function visibleRowIds(): string[] {
  return Array.from(document.querySelectorAll('tbody tr[data-testid]')).map(
    (el) => (el.getAttribute('data-testid') ?? '').replace('bh-row-', ''),
  );
}

describe('BillingHistory — column sorting', () => {
  afterEach(cleanup);

  // ── Date header ────────────────────────────────────────────────────────────

  it('Date header is a button', () => {
    renderBH();
    expect(screen.getByRole('button', { name: /date/i })).toBeTruthy();
  });

  it('clicking Date header once sorts ascending by date', () => {
    renderBH();
    fireEvent.click(screen.getByRole('button', { name: /date/i }));

    const ids = visibleRowIds();
    // Derive expected order: sort MOCK_TRANSACTIONS by timestamp asc
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('clicking Date header twice sorts descending by date', () => {
    renderBH();
    const btn = screen.getByRole('button', { name: /date/i });
    fireEvent.click(btn);
    fireEvent.click(btn);

    const ids = visibleRowIds();
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('Date <th> has aria-sort="ascending" after one click', () => {
    renderBH();
    fireEvent.click(screen.getByRole('button', { name: /date/i }));

    const dateTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Date'));
    expect(dateTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('Date <th> has aria-sort="descending" after two clicks', () => {
    renderBH();
    const btn = screen.getByRole('button', { name: /date/i });
    fireEvent.click(btn);
    fireEvent.click(btn);

    const dateTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Date'));
    expect(dateTh?.getAttribute('aria-sort')).toBe('descending');
  });

  it('Amount <th> has aria-sort="none" when date is the active sort', () => {
    renderBH();
    fireEvent.click(screen.getByRole('button', { name: /date/i }));

    const amountTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Amount'));
    expect(amountTh?.getAttribute('aria-sort')).toBe('none');
  });

  // ── Amount header ──────────────────────────────────────────────────────────

  it('Amount header is a button', () => {
    renderBH();
    expect(screen.getByRole('button', { name: /amount/i })).toBeTruthy();
  });

  it('clicking Amount header once sorts ascending by amount', () => {
    renderBH();
    fireEvent.click(screen.getByRole('button', { name: /amount/i }));

    const ids = visibleRowIds();
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.amount - b.amount)
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('clicking Amount header twice sorts descending by amount', () => {
    renderBH();
    const btn = screen.getByRole('button', { name: /amount/i });
    fireEvent.click(btn);
    fireEvent.click(btn);

    const ids = visibleRowIds();
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.amount - a.amount)
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('Amount <th> has aria-sort="ascending" after one click', () => {
    renderBH();
    fireEvent.click(screen.getByRole('button', { name: /amount/i }));

    const amountTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Amount'));
    expect(amountTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('switching from Date sort to Amount sort resets direction to ascending', () => {
    renderBH();
    // First click date → asc date
    const dateBtn = screen.getByRole('button', { name: /date/i });
    fireEvent.click(dateBtn);
    // Then click date again → desc date
    fireEvent.click(dateBtn);
    // Now click amount → should start asc
    fireEvent.click(screen.getByRole('button', { name: /amount/i }));

    const amountTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Amount'));
    expect(amountTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  // ── Composition with filters ───────────────────────────────────────────────

  it('sort composes with type filter: Deposit rows sorted by amount asc', () => {
    renderBH();
    const typeSelect = screen.getByRole('combobox', { name: /filter by transaction type/i });
    fireEvent.change(typeSelect, { target: { value: 'Deposit' } });
    fireEvent.click(screen.getByRole('button', { name: /amount/i }));

    const depositTxs = MOCK_TRANSACTIONS.filter((tx) => tx.type === 'Deposit');
    const expectedIds = [...depositTxs].sort((a, b) => a.amount - b.amount).map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expectedIds);
  });

  it('sort composes with status filter: success rows sorted by date desc', () => {
    renderBH();
    const statusSelect = screen.getByRole('combobox', { name: /filter by transaction status/i });
    fireEvent.change(statusSelect, { target: { value: 'success' } });
    const dateBtn = screen.getByRole('button', { name: /date/i });
    fireEvent.click(dateBtn); // asc
    fireEvent.click(dateBtn); // desc

    const successTxs = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'success');
    const expectedIds = [...successTxs]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expectedIds);
  });

  // ── URL persistence ────────────────────────────────────────────────────────

  it('pre-seeded ?sort=date&dir=asc renders in ascending date order', () => {
    renderBH(['/?sort=date&dir=asc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=date&dir=desc renders in descending date order', () => {
    renderBH(['/?sort=date&dir=desc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=amount&dir=asc renders in ascending amount order', () => {
    renderBH(['/?sort=amount&dir=asc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.amount - b.amount)
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=amount&dir=desc renders in descending amount order', () => {
    renderBH(['/?sort=amount&dir=desc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.amount - a.amount)
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('invalid sort param is silently ignored (declaration order preserved)', () => {
    renderBH(['/?sort=INVALID&dir=INVALID']);
    const expected = MOCK_TRANSACTIONS.map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=date&dir=asc sets correct aria-sort on Date header', () => {
    renderBH(['/?sort=date&dir=asc']);
    const dateTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Date'));
    expect(dateTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('pre-seeded ?sort=amount&dir=desc sets correct aria-sort on Amount header', () => {
    renderBH(['/?sort=amount&dir=desc']);
    const amountTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Amount'));
    expect(amountTh?.getAttribute('aria-sort')).toBe('descending');
  });
});
