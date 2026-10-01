// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AccountProvider } from './hooks/useAccount';
import { ThemeProvider } from './ThemeContext';

// `src/pages/MarketplacePage.tsx` currently fails to parse on `main` (a stray
// in-function import), so it is stubbed here to keep this suite focused on the
// balance wiring instead of that unrelated defect.
vi.mock('./pages/MarketplacePage', () => ({
  __esModule: true,
  default: () => <div data-testid="marketplace-page-stub" />,
}));

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function renderApp(route = '/dashboard') {
  return render(
    <ThemeProvider>
      <AccountProvider>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </AccountProvider>
    </ThemeProvider>,
  );
}

async function openDepositModal() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Deposit$/i }));
  });
  return screen.getByLabelText('Amount', { exact: true }) as HTMLInputElement;
}

async function setAmount(input: HTMLInputElement, value: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value } });
  });
}

describe('App — real account balances', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('requests balances for the active account on mount', async () => {
    fetchMock.mockResolvedValue(jsonOk({ vault: 284.62, wallet: 1260.5 }));

    renderApp();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/accounts/acct_primary/balances',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(await screen.findByText('284.62 USDC')).toBeTruthy();
  });

  it('shows no hardcoded balance before the first response arrives', async () => {
    fetchMock.mockReturnValue(defer<Response>().promise);

    renderApp();

    expect(screen.getByTestId('dashboard-card-vault').getAttribute('data-balance-state')).toBe('loading');
    expect(screen.queryByText('284.62 USDC')).toBeNull();
    expect(screen.queryByText(/0\.00 USDC/)).toBeNull();
  });

  it('never falls back to the old literal balances when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    renderApp();

    expect(await screen.findAllByText(/could not reach the balances service/i)).toBeTruthy();
    expect(screen.queryByText('284.62 USDC')).toBeNull();
    expect(screen.queryByText('1,260.50 USDC')).toBeNull();
    expect(screen.queryByText(/0\.00 USDC/)).toBeNull();
  });

  it('re-requests balances when the account is switched', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ vault: 284.62, wallet: 1260.5 }))
      .mockResolvedValueOnce(jsonOk({ vault: 12.5, wallet: 40 }));

    renderApp();
    expect(await screen.findByText('284.62 USDC')).toBeTruthy();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'acct_secondary' } });
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/accounts/acct_secondary/balances');
    expect(await screen.findByText('12.50 USDC')).toBeTruthy();
    expect(screen.queryByText('284.62 USDC')).toBeNull();
  });

  it('discards the previous account balances while the new account loads', async () => {
    const second = defer<Response>();
    fetchMock
      .mockResolvedValueOnce(jsonOk({ vault: 284.62, wallet: 1260.5 }))
      .mockReturnValueOnce(second.promise);

    renderApp();
    expect(await screen.findByText('284.62 USDC')).toBeTruthy();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'acct_secondary' } });
    });

    expect(screen.queryByText('284.62 USDC')).toBeNull();
    expect(screen.getByTestId('dashboard-card-vault').getAttribute('data-balance-state')).toBe('loading');
  });

  it('recovers when the user retries a failed balance request', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonOk({ vault: 90, wallet: 120 }));

    renderApp();
    const retry = (await screen.findAllByRole('button', { name: /^Retry$/i }))[0];

    await act(async () => {
      fireEvent.click(retry);
    });

    expect(await screen.findByText('90.00 USDC')).toBeTruthy();
  });
});

describe('App — deposit validation uses the fetched wallet balance', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue(jsonOk({ vault: 500, wallet: 20 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects an amount above the fetched wallet balance', async () => {
    renderApp();

    const input = await openDepositModal();
    await setAmount(input, '500');

    expect(await screen.findByText('Amount exceeds available wallet balance.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Approve deposit transaction/i })).toBeDisabled();
  });

  it('accepts an amount the fetched wallet balance covers', async () => {
    renderApp();

    const input = await openDepositModal();
    await setAmount(input, '20');

    await waitFor(() =>
      expect(screen.queryByText('Amount exceeds available wallet balance.')).toBeNull(),
    );
    expect(screen.getByRole('button', { name: /Approve deposit transaction/i })).not.toBeDisabled();
  });

  it('caps the Max button at the fetched wallet balance, not a hardcoded ceiling', async () => {
    renderApp();

    const input = await openDepositModal();
    const max = screen.getByRole('button', { name: /Set maximum amount/i });

    expect(max.getAttribute('aria-label')).toBe('Set maximum amount: $20');
    await act(async () => {
      fireEvent.click(max);
    });

    expect(input.value).toBe('20.00');
  });

  it('blocks the deposit while the wallet balance is unknown instead of guessing', async () => {
    fetchMock.mockReturnValue(defer<Response>().promise);
    renderApp();

    const input = await openDepositModal();
    await setAmount(input, '50');

    expect(
      await screen.findByText('Wallet balance is unavailable. Retry loading balances before depositing.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Approve deposit transaction/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Set maximum amount/i })).toBeDisabled();
  });

  it('keeps the amount valid when the modal is opened from the billing page', async () => {
    renderApp('/billing');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Open deposit modal/i }));
    });

    const input = screen.getByLabelText('Amount', { exact: true }) as HTMLInputElement;
    expect(input.value).toBe('50');
    expect(screen.queryByText('Amount must be a valid number.')).toBeNull();

    // 50 USDC exceeds the fetched 20 USDC wallet balance, which proves the
    // validation is comparing against the request and not a literal.
    await screen.findByText('Amount exceeds available wallet balance.');
  });
});

describe('App — refetch after a confirmed deposit', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  /** Flushes the promise chain that resolves the balances request. */
  async function flushBalances() {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue(jsonOk({ vault: 500, wallet: 900 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('re-reads balances once the deposit reaches the confirmed stage', async () => {
    renderApp();
    await flushBalances();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Deposit$/i }));
    });

    const approve = screen.getByRole('button', { name: /Approve deposit transaction/i });
    expect(approve).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(approve);
    });

    await act(async () => {
      vi.advanceTimersByTime(1400);
    });
    expect(screen.getAllByText(/Transaction submitted/i).length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(3600);
    });

    expect(screen.getAllByText('Deposit successful').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/accounts/acct_primary/balances');
  });

  it('does not re-read balances when the deposit fails', async () => {
    renderApp('/billing');
    await flushBalances();

    // The billing page exposes the demo outcome toggle.
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /Failed path/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Open deposit modal/i }));
    });
    await flushBalances();

    const approve = screen.getByRole('button', { name: /Approve deposit transaction/i });
    expect(approve).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(approve);
    });
    await act(async () => {
      vi.advanceTimersByTime(1400 + 3600);
    });

    expect(screen.getAllByText('Approval not confirmed').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
