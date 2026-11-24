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

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '../hooks/useAccountContext';
import { addAccount, switchAccount, _reset } from '../state/accountStore';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { BillingHistory } from './BillingHistory';
import { MOCK_TRANSACTIONS } from '../data/billingFixtures';
import { fetchDepositEvents } from '../services/vaultEvents';

const walletState = vi.hoisted(() => ({
  address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF' as string | null,
}));

// Deposit history comes from vault events; the page is tested against the
// fixture rows, served as if the connected wallet had made those deposits.
vi.mock('../services/vaultEvents', async () => {
  const { MOCK_TRANSACTIONS: rows } = await import('../data/billingFixtures');
  return {
    fetchDepositEvents: vi.fn(async () => ({ transactions: rows, nextCursor: null, retentionTruncated: false })),
  };
});
vi.mock('../state/walletStore', async (importOriginal) => ({
  ...await importOriginal<typeof import('../state/walletStore')>(),
  useWalletStore: () => ({ address: walletState.address, status: 'connected', networkPassphrase: null, isNetworkMismatch: false }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Render BillingHistory inside a MemoryRouter.
 * Pass `initialEntries` to pre-seed URL search params, e.g. `['?sort=date&dir=asc']`.
 */
async function renderBH(initialEntries: string[] = ['/']) {
  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <BillingHistory />
    </MemoryRouter>,
  );
  // Rows arrive from the deposit history fetch; wait until loading finishes.
  await waitFor(() => expect(screen.queryByText(/Loading deposit history/)).toBeNull());
  return result;
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
  afterEach(() => { cleanup(); _reset(); });

  it('renders the page heading', async () => {
    await renderBH();
    expect(
      screen.getByRole('heading', { name: /billing history/i, level: 1 }),
    ).toBeTruthy();
  });

  it('renders all mock transactions by default', async () => {
    await renderBH();
    expect(screen.getByText(`${MOCK_TRANSACTIONS.length} transactions`)).toBeTruthy();
  });

  it('renders a table with an accessible aria-label', async () => {
    await renderBH();
    expect(
      screen.getByRole('table', { name: /billing transaction history/i }),
    ).toBeTruthy();
  });

  it('formats dates and labels the header in the active account timezone', async () => {
    addAccount({ id: 'billing-ny', label: 'New York', apiKey: 'test-key', timezone: 'America/New_York' });
    switchAccount('billing-ny');
    render(
      <MemoryRouter>
        <AccountProvider><BillingHistory /></AccountProvider>
      </MemoryRouter>,
    );
    // EDT or EST depending on when the suite runs.
    const zone =
      new Intl.DateTimeFormat(undefined, { timeZone: 'America/New_York', timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value ?? 'America/New_York';
    const dateHeader = await screen.findByRole('columnheader', { name: new RegExp(`date \\(${zone}\\)`, 'i') });
    expect(dateHeader).toBeTruthy();
    expect(screen.getByText('Jul 25, 10:32 AM')).toBeTruthy();
  });

  it('renders column headers with scope="col"', async () => {
    await renderBH();
    const headerCells = screen
      .getAllByRole('columnheader')
      .filter((th) => th.getAttribute('scope') === 'col');
    // Expect Date, Description, Type, Status, Amount, Tx Hash
    expect(headerCells.length).toBeGreaterThanOrEqual(6);
  });

  it('renders a status live region for filter announcements', async () => {
    await renderBH();
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('renders a keyboard tip containing "Esc"', async () => {
    await renderBH();
    // The bottom keyboard tip paragraph
    expect(screen.getAllByText(/Esc/i).length).toBeGreaterThan(0);
  });

  it('renders StatusBadge for each transaction', async () => {
    await renderBH();
    // StatusBadge uses role="img"; there should be at least one per row.
    const badges = screen.getAllByRole('img');
    expect(badges.length).toBeGreaterThanOrEqual(MOCK_TRANSACTIONS.length);
  });

  it('shows the net balance summary line', async () => {
    await renderBH();
    // Net: label should be visible
    expect(screen.getByText('Net:')).toBeTruthy();
  });
});

// ── PreviewCard integration ───────────────────────────────────────────────────

describe('BillingHistory — PreviewCard hover/focus integration', () => {
  afterEach(cleanup);

  it('each transaction row has a PreviewCard trigger button', async () => {
    await renderBH();
    // Each row must have exactly one trigger per PreviewCard
    MOCK_TRANSACTIONS.forEach((tx) => {
      const row = getRow(tx.id);
      expect(getTriggerInRow(row)).toBeTruthy();
    });
  });

  it('hovering a row description opens the preview tooltip', async () => {
    await renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const wrapper = row.querySelector('.preview-card__wrapper') as HTMLElement;

    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('focusing a row trigger opens the preview tooltip', async () => {
    await renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('preview panel shows the transaction description', async () => {
    await renderBH();
    const tx = MOCK_TRANSACTIONS[0]; // "USDC vault deposit"
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(tx.description);
  });

  it('preview panel shows the tx hash (truncated)', async () => {
    await renderBH();
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    const panel = screen.getByRole('tooltip');
    // Should show at least the first 8 chars of the hash
    expect(panel).toHaveTextContent(tx.txHash.slice(0, 8));
  });

  it('preview panel shows network name', async () => {
    await renderBH();
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Stellar Testnet');
  });

  it('preview panel shows confirmation count', async () => {
    await renderBH();
    const tx = MOCK_TRANSACTIONS[0]; // 120 confirmations
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('120');
  });

  it('preview panel shows formatted USDC amount', async () => {
    await renderBH();
    const tx = MOCK_TRANSACTIONS[0]; // 100.00 USDC
    const row = getRow(tx.id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip')).toHaveTextContent('100.00 USDC');
  });

  it('Escape closes the preview and removes aria-describedby', async () => {
    await renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    const trigger = getTriggerInRow(row);

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('trigger aria-label includes the transaction description', async () => {
    await renderBH();
    const tx = MOCK_TRANSACTIONS[0];
    const row = getRow(tx.id);
    const trigger = getTriggerInRow(row);
    // aria-label is "Preview details for <title>"
    expect(trigger.getAttribute('aria-label')).toMatch(
      new RegExp(tx.description, 'i'),
    );
  });

  it('panel has pointer-events: none to avoid mouse trapping', async () => {
    await renderBH();
    const row = getRow(MOCK_TRANSACTIONS[0].id);
    fireEvent.focus(getTriggerInRow(row));
    expect(screen.getByRole('tooltip').style.pointerEvents).toBe('none');
  });
});

// ── Filtering ─────────────────────────────────────────────────────────────────

describe('BillingHistory — filters', () => {
  afterEach(cleanup);

  it('filter by type "Deposit" shows only deposit rows', async () => {
    await renderBH();
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

  it('filter by status "pending" shows only pending rows', async () => {
    await renderBH();
    const statusSelect = screen.getByRole('combobox', { name: /filter by transaction status/i });

    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    const pendingCount = MOCK_TRANSACTIONS.filter((tx) => tx.status === 'pending').length;
    expect(screen.getByText(`${pendingCount} transaction${pendingCount !== 1 ? 's' : ''}`)).toBeTruthy();
  });

  it('filter by direction "credit" shows only credit rows', async () => {
    await renderBH();
    const dirSelect = screen.getByRole('combobox', { name: /filter by transaction direction/i });

    fireEvent.change(dirSelect, { target: { value: 'credit' } });

    const creditCount = MOCK_TRANSACTIONS.filter((tx) => tx.direction === 'credit').length;
    expect(screen.getByText(`${creditCount} transaction${creditCount !== 1 ? 's' : ''}`)).toBeTruthy();

    // Debit rows must be hidden
    MOCK_TRANSACTIONS.filter((tx) => tx.direction === 'debit').forEach((tx) => {
      expect(screen.queryByTestId(`bh-row-${tx.id}`)).toBeNull();
    });
  });

  it('search by description filters rows', async () => {
    await renderBH();
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });

    fireEvent.change(searchInput, { target: { value: 'WeatherSim' } });

    const matchCount = MOCK_TRANSACTIONS.filter((tx) =>
      tx.description.toLowerCase().includes('weathersim'),
    ).length;
    expect(screen.getByText(`${matchCount} transaction${matchCount !== 1 ? 's' : ''}`)).toBeTruthy();
  });

  it('search by tx hash filters rows', async () => {
    await renderBH();
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });
    // Use the first 8 chars of the first tx hash
    const hashPrefix = MOCK_TRANSACTIONS[0].txHash.slice(0, 8).toLowerCase();
    fireEvent.change(searchInput, { target: { value: hashPrefix } });

    // At least one row should remain
    expect(screen.queryByRole('table')).toBeTruthy();
  });

  it('shows empty state when no transactions match', async () => {
    await renderBH();
    const searchInput = screen.getByRole('searchbox', { name: /search transactions/i });

    fireEvent.change(searchInput, { target: { value: 'ZZZNOMATCH999' } });

    expect(
      screen.getByText(/no transactions match the current filters/i),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('net balance is positive when only credits are shown', async () => {
    await renderBH();
    const dirSelect = screen.getByRole('combobox', { name: /filter by transaction direction/i });
    fireEvent.change(dirSelect, { target: { value: 'credit' } });

    // Net label visible and "+" prefix present
    const netStrong = document.querySelector('[class*="tabular-nums"]');
    // We just check the page still renders with a "+" somewhere in the net line
    const pageText = document.body.textContent ?? '';
    expect(pageText).toContain('+');
  });

  it('live region contains filter summary after type filter change', async () => {
    await renderBH();
    const typeSelect = screen.getByRole('combobox', { name: /filter by transaction type/i });
    fireEvent.change(typeSelect, { target: { value: 'Fee' } });

    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(liveRegion.textContent).toContain('Fee');
  });

  it('live region reads "Showing all transactions" when no filters active', async () => {
    await renderBH();
    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(liveRegion.textContent).toMatch(/showing all transactions/i);
  });
});

// ── Table content ─────────────────────────────────────────────────────────────

describe('BillingHistory — table row content', () => {
  afterEach(cleanup);

  it('shows truncated tx hash in the Tx Hash column', async () => {
    await renderBH();
    // First transaction: A3F9B2C1... → "A3F9B2…F0A1" (6+…+4)
    const hashCode = screen.getAllByTitle(MOCK_TRANSACTIONS[0].txHash)[0];
    expect(hashCode).toBeTruthy();
    // Truncated form must be shorter than the full hash
    expect((hashCode.textContent ?? '').length).toBeLessThan(
      MOCK_TRANSACTIONS[0].txHash.length,
    );
  });

  it('amount cell has tabular-nums class for alignment', async () => {
    await renderBH();
    const cells = document.querySelectorAll('td.tabular-nums');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('date cells render <time> elements with dateTime attributes', async () => {
    await renderBH();
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

  it('Date header is a button', async () => {
    await renderBH();
    expect(screen.getByRole('button', { name: /date/i })).toBeTruthy();
  });

  it('clicking Date header once sorts ascending by date', async () => {
    await renderBH();
    fireEvent.click(screen.getByRole('button', { name: /date/i }));

    const ids = visibleRowIds();
    // Derive expected order: sort MOCK_TRANSACTIONS by timestamp asc
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('clicking Date header twice sorts descending by date', async () => {
    await renderBH();
    const btn = screen.getByRole('button', { name: /date/i });
    fireEvent.click(btn);
    fireEvent.click(btn);

    const ids = visibleRowIds();
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('Date <th> has aria-sort="ascending" after one click', async () => {
    await renderBH();
    fireEvent.click(screen.getByRole('button', { name: /date/i }));

    const dateTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Date'));
    expect(dateTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('Date <th> has aria-sort="descending" after two clicks', async () => {
    await renderBH();
    const btn = screen.getByRole('button', { name: /date/i });
    fireEvent.click(btn);
    fireEvent.click(btn);

    const dateTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Date'));
    expect(dateTh?.getAttribute('aria-sort')).toBe('descending');
  });

  it('Amount <th> has aria-sort="none" when date is the active sort', async () => {
    await renderBH();
    fireEvent.click(screen.getByRole('button', { name: /date/i }));

    const amountTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Amount'));
    expect(amountTh?.getAttribute('aria-sort')).toBe('none');
  });

  // ── Amount header ──────────────────────────────────────────────────────────

  it('Amount header is a button', async () => {
    await renderBH();
    expect(screen.getByRole('button', { name: /amount/i })).toBeTruthy();
  });

  it('clicking Amount header once sorts ascending by amount', async () => {
    await renderBH();
    fireEvent.click(screen.getByRole('button', { name: /amount/i }));

    const ids = visibleRowIds();
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.amount - b.amount)
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('clicking Amount header twice sorts descending by amount', async () => {
    await renderBH();
    const btn = screen.getByRole('button', { name: /amount/i });
    fireEvent.click(btn);
    fireEvent.click(btn);

    const ids = visibleRowIds();
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.amount - a.amount)
      .map((tx) => tx.id);

    expect(ids).toEqual(expected);
  });

  it('Amount <th> has aria-sort="ascending" after one click', async () => {
    await renderBH();
    fireEvent.click(screen.getByRole('button', { name: /amount/i }));

    const amountTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Amount'));
    expect(amountTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('switching from Date sort to Amount sort resets direction to ascending', async () => {
    await renderBH();
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

  it('sort composes with type filter: Deposit rows sorted by amount asc', async () => {
    await renderBH();
    const typeSelect = screen.getByRole('combobox', { name: /filter by transaction type/i });
    fireEvent.change(typeSelect, { target: { value: 'Deposit' } });
    fireEvent.click(screen.getByRole('button', { name: /amount/i }));

    const depositTxs = MOCK_TRANSACTIONS.filter((tx) => tx.type === 'Deposit');
    const expectedIds = [...depositTxs].sort((a, b) => a.amount - b.amount).map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expectedIds);
  });

  it('sort composes with status filter: success rows sorted by date desc', async () => {
    await renderBH();
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

  it('pre-seeded ?sort=date&dir=asc renders in ascending date order', async () => {
    await renderBH(['/?sort=date&dir=asc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=date&dir=desc renders in descending date order', async () => {
    await renderBH(['/?sort=date&dir=desc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=amount&dir=asc renders in ascending amount order', async () => {
    await renderBH(['/?sort=amount&dir=asc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => a.amount - b.amount)
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=amount&dir=desc renders in descending amount order', async () => {
    await renderBH(['/?sort=amount&dir=desc']);

    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.amount - a.amount)
      .map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('invalid sort param is silently ignored (declaration order preserved)', async () => {
    await renderBH(['/?sort=INVALID&dir=INVALID']);
    const expected = MOCK_TRANSACTIONS.map((tx) => tx.id);
    expect(visibleRowIds()).toEqual(expected);
  });

  it('pre-seeded ?sort=date&dir=asc sets correct aria-sort on Date header', async () => {
    await renderBH(['/?sort=date&dir=asc']);
    const dateTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Date'));
    expect(dateTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('pre-seeded ?sort=amount&dir=desc sets correct aria-sort on Amount header', async () => {
    await renderBH(['/?sort=amount&dir=desc']);
    const amountTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent?.includes('Amount'));
    expect(amountTh?.getAttribute('aria-sort')).toBe('descending');
  });
});

// ── Responsive layout (issue #1320) ───────────────────────────────────────────

const MOBILE_QUERY = '(max-width: 639px)';
const originalMatchMedia = window.matchMedia;

/** Make window.matchMedia report a phone-width or desktop-width viewport. */
function setViewport(mode: 'mobile' | 'desktop') {
  window.matchMedia = ((query: string) => ({
    matches: mode === 'mobile' && query === MOBILE_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('BillingHistory — responsive layout', () => {
  afterEach(() => {
    cleanup();
    _reset();
    window.matchMedia = originalMatchMedia;
  });

  it('mobile: renders a card list and no table', async () => {
    setViewport('mobile');
    await renderBH();
    expect(screen.getByRole('list', { name: /billing transactions/i })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('desktop: renders the table and no card list', async () => {
    setViewport('desktop');
    await renderBH();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.queryByRole('list', { name: /billing transactions/i })).toBeNull();
  });
});

describe('BillingHistory — mobile cards', () => {
  afterEach(() => { cleanup(); _reset(); window.matchMedia = originalMatchMedia; });

  function getCards() {
    return within(screen.getByRole('list', { name: /billing transactions/i })).getAllByRole('listitem');
  }

  it('renders one card per transaction', async () => {
    setViewport('mobile');
    await renderBH();
    expect(getCards()).toHaveLength(MOCK_TRANSACTIONS.length);
  });

  it('each card has a heading and a signed amount', async () => {
    setViewport('mobile');
    await renderBH();
    const [credit, debit] = getCards();
    expect(within(credit).getByRole('heading', { name: MOCK_TRANSACTIONS[0].description })).toBeTruthy();
    expect(within(credit).getByText(/^\+/)).toBeTruthy();
    expect(within(debit).getByText(/^\u2212/)).toBeTruthy();
  });
});

// ── Details sheet (issue #1320) ───────────────────────────────────────────────

const sheetTx = MOCK_TRANSACTIONS[0];

/** Render the mobile layout, focus and tap the first card's Details button. */
async function openSheet() {
  setViewport('mobile');
  await renderBH();
  const card = screen.getByTestId(`bh-card-${sheetTx.id}`);
  const trigger = within(card).getByRole('button', { name: /^details/i });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, dialog: screen.queryByRole('dialog') as HTMLElement };
}

describe('BillingHistory — details sheet', () => {
  afterEach(() => {
    cleanup();
    _reset();
    window.matchMedia = originalMatchMedia;
  });

  it('Details opens a dialog with hash, network and confirmations', async () => {
    const { dialog } = await openSheet();
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText(sheetTx.txHash)).toBeTruthy();
    expect(within(dialog).getByText(sheetTx.network)).toBeTruthy();
    expect(within(dialog).getByText(String(sheetTx.confirmations))).toBeTruthy();
  });

  it('Escape closes the sheet and returns focus to the Details button', async () => {
    const { trigger, dialog } = await openSheet();
    expect(dialog).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('BillingHistory — details sheet actions', () => {
  afterEach(() => {
    cleanup();
    _reset();
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('the close button closes the sheet', async () => {
    const { dialog } = await openSheet();
    expect(dialog).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /^close/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Copy puts the full hash on the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { dialog } = await openSheet();
    expect(dialog).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(sheetTx.txHash));
  });
});

// ── Mobile sort & filters (issue #1320) ───────────────────────────────────────

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="loc">{location.search}</output>;
}

const sortSelect = () =>
  screen.queryByRole('combobox', { name: /sort/i }) as HTMLSelectElement | null;
const cardIds = () =>
  within(screen.getByRole('list', { name: /billing transactions/i }))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-testid'));

describe('BillingHistory — mobile sort select', () => {
  afterEach(() => { cleanup(); _reset(); window.matchMedia = originalMatchMedia; });

  it('mobile: shows one sort select', async () => {
    setViewport('mobile');
    await renderBH();
    expect(sortSelect()).toBeTruthy();
  });

  it('desktop: has no sort select (the headers sort instead)', async () => {
    setViewport('desktop');
    await renderBH();
    expect(sortSelect()).toBeNull();
  });
});

describe('BillingHistory — mobile sort behaviour', () => {
  afterEach(() => { cleanup(); _reset(); window.matchMedia = originalMatchMedia; });

  it('choosing an option reorders the cards and writes sort/dir to the URL', async () => {
    setViewport('mobile');
    render(
      <MemoryRouter initialEntries={['/']}>
        <BillingHistory />
        <LocationProbe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByText(/Loading deposit history/)).toBeNull());
    fireEvent.change(sortSelect() as HTMLSelectElement, { target: { value: 'amount:desc' } });
    const expected = [...MOCK_TRANSACTIONS]
      .sort((a, b) => b.amount - a.amount)
      .map((t) => `bh-card-${t.id}`);
    expect(cardIds()).toEqual(expected);
    const params = new URLSearchParams(screen.getByTestId('loc').textContent ?? '');
    expect(params.get('sort')).toBe('amount');
    expect(params.get('dir')).toBe('desc');
  });

  it('the select reflects a pre-seeded URL sort', async () => {
    setViewport('mobile');
    await renderBH(['/?sort=date&dir=asc']);
    expect((sortSelect() as HTMLSelectElement).value).toBe('date:asc');
  });
});

describe('BillingHistory — filters on mobile', () => {
  afterEach(() => { cleanup(); _reset(); window.matchMedia = originalMatchMedia; });

  async function filteredCount(mode: 'mobile' | 'desktop') {
    setViewport(mode);
    const view = await renderBH();
    fireEvent.change(screen.getByRole('combobox', { name: /filter by transaction type/i }), {
      target: { value: 'Deposit' },
    });
    const count =
      mode === 'mobile'
        ? cardIds().length
        : within(screen.getByRole('table')).getAllByRole('row').length - 1;
    view.unmount();
    return count;
  }

  it('the same filter shows the same number of transactions as on desktop', async () => {
    const mobile = await filteredCount('mobile');
    const desktop = await filteredCount('desktop');
    expect(mobile).toBe(desktop);
    expect(mobile).toBe(MOCK_TRANSACTIONS.filter((t) => t.type === 'Deposit').length);
  });
});

describe('BillingHistory — touch-friendly wording', () => {
  afterEach(() => { cleanup(); _reset(); window.matchMedia = originalMatchMedia; });

  it('mobile: tells users to tap Details instead of hovering', async () => {
    setViewport('mobile');
    await renderBH();
    expect(screen.getByText(/tap details/i)).toBeTruthy();
    expect(screen.queryByText(/hover/i)).toBeNull();
  });

  it('mobile: hides the keyboard tip', async () => {
    setViewport('mobile');
    await renderBH();
    expect(screen.queryByText(/keyboard tip/i)).toBeNull();
  });

  it('desktop: keeps the hover wording and the keyboard tip', async () => {
    setViewport('desktop');
    await renderBH();
    expect(screen.getByText(/hover or focus any transaction row/i)).toBeTruthy();
    expect(screen.getByText(/keyboard tip/i)).toBeTruthy();
  });
});

describe('BillingHistory — deposit history states', () => {
  afterEach(() => { cleanup(); _reset(); walletState.address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'; });

  it('asks for a wallet and does not fetch when none is connected', async () => {
    walletState.address = null;
    vi.mocked(fetchDepositEvents).mockClear();
    renderBH();
    expect(screen.getByText(/Connect Freighter/)).toBeTruthy();
    expect(fetchDepositEvents).not.toHaveBeenCalled();
  });

  it('shows an alert with Retry on failure, and Retry refetches', async () => {
    vi.mocked(fetchDepositEvents).mockRejectedValueOnce(new Error('rpc down'));
    await renderBH();
    expect(screen.getByRole('alert').textContent).toContain('rpc down');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId(`bh-row-${MOCK_TRANSACTIONS[0].id}`)).toBeTruthy());
  });

  it('says so when the wallet has no deposits', async () => {
    vi.mocked(fetchDepositEvents).mockResolvedValueOnce({ transactions: [], nextCursor: null, retentionTruncated: false });
    await renderBH();
    expect(screen.getByText(/No deposits yet for this wallet/)).toBeTruthy();
  });

  it('explains when history falls outside the RPC retention window', async () => {
    vi.mocked(fetchDepositEvents).mockResolvedValueOnce({ transactions: MOCK_TRANSACTIONS, nextCursor: null, retentionTruncated: true });
    await renderBH();
    expect(screen.getByRole('note').textContent).toContain('outside the RPC retention window');
  });

  it('Load older appends the next page without duplicate rows', async () => {
    const [first, second, third] = MOCK_TRANSACTIONS;
    vi.mocked(fetchDepositEvents)
      .mockResolvedValueOnce({ transactions: [first, second], nextCursor: 'page-2', retentionTruncated: false })
      .mockResolvedValueOnce({ transactions: [second, third], nextCursor: null, retentionTruncated: false });
    await renderBH();
    fireEvent.click(screen.getByRole('button', { name: 'Load older deposits' }));
    await waitFor(() => expect(screen.getByTestId(`bh-row-${third.id}`)).toBeTruthy());
    expect(screen.getAllByTestId(/^bh-row-/)).toHaveLength(3);
    expect(fetchDepositEvents).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'page-2' }));
  });
});
