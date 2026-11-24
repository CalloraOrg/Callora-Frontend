import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvoiceCard, BillingInvoiceSection } from './InvoiceCard';
import { addAccount, switchAccount, _reset } from '../state/accountStore';
import * as constants from '../config/constants';

function simulateScroll(y: number) {
  Object.defineProperty(window, 'scrollY', {
    writable: true,
    configurable: true,
    value: y,
  });
  window.dispatchEvent(new Event('scroll'));
}

describe('InvoiceCard sticky action bar', () => {
  it('keeps the action bar hidden until the card is scrolled', () => {
    render(<InvoiceCard invoiceNumber="INV-1001" amountDue="4,200.00 USDC" />);

    const bar = screen.getByTestId('invoice-card-action-bar');
    expect(bar).toBeInTheDocument();
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(false);
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('reveals the sticky action bar after scrolling and exposes the primary action', () => {
    const onPay = vi.fn();
    render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="4,200.00 USDC"
        onPay={onPay}
      />,
    );

    act(() => {
      simulateScroll(220);
    });

    const bar = screen.getByTestId('invoice-card-action-bar');
    expect(bar.classList.contains('theme-sticky-bar--visible')).toBe(true);
    expect(bar).toHaveAttribute('aria-hidden', 'false');

    const payButton = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payButton);
    expect(onPay).toHaveBeenCalledTimes(1);
  });
});

describe('InvoiceCard timezone and due date rendering', () => {
  beforeEach(() => {
    localStorage.clear();
    _reset();
  });

  afterEach(() => {
    localStorage.clear();
    _reset();
  });

  it('renders default relative due date string unchanged', () => {
    render(<InvoiceCard invoiceNumber="INV-1001" amountDue="4,200.00 USDC" dueDate="Due in 7 days" />);
    const dueDateElement = screen.getByTestId('invoice-card-due-date');
    expect(dueDateElement).toHaveTextContent('Due in 7 days');
  });

  it('renders ISO due date formatted in explicit timezone prop', () => {
    // 2026-09-01T01:00:00Z -> Aug 31, 2026 in America/New_York (EDT)
    render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="4,200.00 USDC"
        dueDate="2026-09-01T01:00:00Z"
        timezone="America/New_York"
        locale="en-US"
      />
    );
    const dueDateElement = screen.getByTestId('invoice-card-due-date');
    expect(dueDateElement).toHaveTextContent('Aug 31, 2026');
  });

  it('renders ISO due date formatted in active account timezone from account store', () => {
    addAccount({
      id: 'acc-tokyo',
      label: 'Tokyo Account',
      apiKey: 'key-123',
      timezone: 'Asia/Tokyo',
    });
    switchAccount('acc-tokyo');

    // 2026-09-01T01:00:00Z -> Sep 1, 2026 in Asia/Tokyo (JST)
    render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="4,200.00 USDC"
        dueDate="2026-09-01T01:00:00Z"
        locale="en-US"
      />
    );
    const dueDateElement = screen.getByTestId('invoice-card-due-date');
    expect(dueDateElement).toHaveTextContent('Sep 1, 2026');
  });

  it('dynamically updates invoice due date display when account switches', () => {
    addAccount({
      id: 'acc-ny',
      label: 'NY Account',
      apiKey: 'key-ny',
      timezone: 'America/New_York',
    });
    addAccount({
      id: 'acc-tokyo',
      label: 'Tokyo Account',
      apiKey: 'key-tokyo',
      timezone: 'Asia/Tokyo',
    });

    switchAccount('acc-ny');

    render(
      <InvoiceCard
        invoiceNumber="INV-1001"
        amountDue="4,200.00 USDC"
        dueDate="2026-09-01T01:00:00Z"
        locale="en-US"
      />
    );

    expect(screen.getByTestId('invoice-card-due-date')).toHaveTextContent('Aug 31, 2026');

    act(() => {
      switchAccount('acc-tokyo');
    });

    expect(screen.getByTestId('invoice-card-due-date')).toHaveTextContent('Sep 1, 2026');
  });
});

describe('BillingInvoiceSection & /api/invoices integration (Issue #1321)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    _reset();
    vi.spyOn(constants, 'API_BASE', 'get').mockReturnValue('https://api.callora.com');
    vi.spyOn(constants, 'apiUrl').mockImplementation((p) => `https://api.callora.com${p}`);
  });

  afterEach(() => {
    localStorage.clear();
    _reset();
  });

  it('Scenario 1: One pending invoice with total_amount_usdc "12.3456789" shows 12.3456789 USDC with no $', async () => {
    const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'inv-1',
              invoice_number: 'INV-2026-042',
              status: 'pending',
              total_amount_usdc: '12.3456789',
              currency: 'USDC',
              period_start: '2026-08-01T00:00:00Z',
              period_end: '2026-09-01T01:00:00Z',
            },
          ],
          meta: { limit: 20, nextCursor: null, hasMore: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter>
        <BillingInvoiceSection fetchImpl={fetchImpl} locale="en-US" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('invoice-card-skeleton')).toHaveAttribute('aria-busy', 'true');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'INV-2026-042' })).toBeInTheDocument();
    });

    const amountEl = screen.getByTestId('invoice-card-amount');
    expect(amountEl).toHaveTextContent('12.3456789 USDC');
    expect(amountEl.textContent).not.toContain('$');
    expect(screen.getByRole('img', { name: 'Pending' })).toBeInTheDocument();
  });

  it('Scenario 2: Only paid invoices shows "No outstanding invoices" with link to Billing History', async () => {
    const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'inv-paid-1',
              invoice_number: 'INV-2026-040',
              status: 'paid',
              total_amount_usdc: '50.0000000',
              currency: 'USDC',
              period_end: '2026-08-01T00:00:00Z',
            },
          ],
          meta: { limit: 20, nextCursor: null, hasMore: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter>
        <BillingInvoiceSection fetchImpl={fetchImpl} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No outstanding invoices')).toBeInTheDocument();
    });

    const historyLink = screen.getByRole('link', { name: /Billing History/i });
    expect(historyLink).toHaveAttribute('href', '/billing/history');
  });

  it('Scenario 3: Empty data shows the same "No outstanding invoices" empty state', async () => {
    const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          meta: { limit: 20, nextCursor: null, hasMore: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter>
        <BillingInvoiceSection fetchImpl={fetchImpl} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No outstanding invoices')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Billing History/i })).toBeInTheDocument();
  });

  it('Scenario 4: 401 renders sign-in prompt and does not crash', async () => {
    const fetchImpl: typeof fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );

    render(
      <MemoryRouter>
        <BillingInvoiceSection fetchImpl={fetchImpl} />
      </MemoryRouter>,
    );

    const alert = await screen.findByTestId('invoice-card-unauthorized');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/sign in/i);
  });

  it('Scenario 5: 500 renders error with Retry button, and clicking Retry refetches', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = vi.fn().mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(new Response('Server Error', { status: 500 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'inv-recovered',
                invoice_number: 'INV-2026-099',
                status: 'pending',
                total_amount_usdc: '99.0000000',
                currency: 'USDC',
                period_end: '2026-09-15T00:00:00Z',
              },
            ],
            meta: { limit: 20, nextCursor: null, hasMore: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    render(
      <MemoryRouter>
        <BillingInvoiceSection fetchImpl={fetchImpl} locale="en-US" />
      </MemoryRouter>,
    );

    const errorAlert = await screen.findByTestId('invoice-card-error');
    expect(errorAlert).toHaveAttribute('role', 'alert');

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'INV-2026-099' })).toBeInTheDocument();
    });
    expect(screen.getByTestId('invoice-card-amount')).toHaveTextContent('99.00 USDC');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('Scenario 6: Unknown status "weird" renders a neutral badge without crashing', () => {
    render(
      <InvoiceCard
        invoiceNumber="INV-WEIRD-1"
        amountDue="10.00 USDC"
        status="weird"
      />,
    );

    const badge = screen.getByRole('img', { name: 'Unknown' });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-status', 'maintenance');
  });

  it('Scenario 7: Account switch mid-request aborts and ignores stale response', async () => {
    addAccount({
      id: 'acc-1',
      label: 'Account One',
      apiKey: 'key-1',
      timezone: 'America/New_York',
    });
    addAccount({
      id: 'acc-2',
      label: 'Account Two',
      apiKey: 'key-2',
      timezone: 'Asia/Tokyo',
    });
    switchAccount('acc-1');

    let resolveFirst!: (res: Response) => void;
    let firstSignal: AbortSignal | undefined;

    const fetchImpl: typeof fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      if (!firstSignal) {
        firstSignal = init?.signal ?? undefined;
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'inv-acc-2',
                invoice_number: 'INV-ACC-2',
                status: 'pending',
                total_amount_usdc: '22.0000000',
                currency: 'USDC',
                period_end: '2026-09-01T01:00:00Z',
              },
            ],
            meta: { limit: 20, nextCursor: null, hasMore: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    render(
      <MemoryRouter>
        <BillingInvoiceSection fetchImpl={fetchImpl} locale="en-US" />
      </MemoryRouter>,
    );

    // Switch account while first request is still pending
    act(() => {
      switchAccount('acc-2');
    });

    expect(firstSignal?.aborted).toBe(true);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'INV-ACC-2' })).toBeInTheDocument();
    });

    // Now resolve the stale first request with a different invoice
    await act(async () => {
      resolveFirst(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'inv-acc-1-stale',
                invoice_number: 'INV-STALE-1',
                status: 'pending',
                total_amount_usdc: '999.0000000',
                currency: 'USDC',
                period_end: '2026-09-01T01:00:00Z',
              },
            ],
            meta: { limit: 20, nextCursor: null, hasMore: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    // Stale response must be ignored; INV-ACC-2 remains displayed
    expect(screen.getByRole('heading', { name: 'INV-ACC-2' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'INV-STALE-1' })).not.toBeInTheDocument();
  });

  it('Scenario 8: Demo mode renders clearly labelled demo invoice and performs no fetch', () => {
    vi.spyOn(constants, 'API_BASE', 'get').mockReturnValue('');
    const globalFetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <MemoryRouter>
        <BillingInvoiceSection locale="en-US" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('invoice-card-demo-badge')).toHaveTextContent(/Demo invoice/i);
    expect(screen.getByRole('heading', { name: 'DEMO-INV-001' })).toBeInTheDocument();
    expect(screen.getByTestId('invoice-card-amount')).toHaveTextContent('42.50 USDC');
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });
});
