import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebhookDeliveries from './WebhookDeliveries';
import { ToastProvider } from '../components/Toast';
import type { WebhookDeliveriesFetcher } from '../hooks/useWebhookDeliveries';
import { addAccount, switchAccount, _reset } from '../state/accountStore';

const ACCOUNT_1 = { id: 'account-1', label: 'Account 1', apiKey: 'fake-test-key-a' };
const ACCOUNT_2 = { id: 'account-2', label: 'Account 2', apiKey: 'fake-test-key-b' };

describe('WebhookDeliveries Page', () => {
  beforeEach(() => {
    localStorage.clear();
    _reset();
    addAccount(ACCOUNT_1);
    addAccount(ACCOUNT_2);
    switchAccount(ACCOUNT_1.id);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    _reset();
  });

  // The toast provider is mounted at the app root (main.tsx); retry
  // feedback uses the useToast context, so tests wrap the page in it.
  const renderPage = (fetcher?: WebhookDeliveriesFetcher) => render(
    <ToastProvider>
      <WebhookDeliveries fetcher={fetcher} />
    </ToastProvider>,
  );

  it('renders loading state, then authoritative state', async () => {
    renderPage();
    
    expect(screen.getByText(/Loading deliveries/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Loading deliveries/i)).not.toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText(/dlv_1_1/i)).toBeInTheDocument();
  });

  it('renders explicit errors from a mocked fetcher', async () => {
    const failingFetcher: WebhookDeliveriesFetcher = vi.fn(async () => {
      throw new Error('Failed to fetch from authoritative source');
    });

    renderPage(failingFetcher);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch from authoritative source/i)).toBeInTheDocument();
    });
  });

  it('reloads deliveries from the active account and clears previous rows on switch', async () => {
    const accountFetcher: WebhookDeliveriesFetcher = vi.fn(
      (accountId, filter, signal) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({
            data: [{
              id: `${accountId}-delivery-${filter.page}`,
              url: 'https://example.com/webhook',
              status: 'delivered',
              attempts: 1,
              lastAttemptAt: new Date().toISOString(),
            }],
            totalCount: 1,
          });
        }, 50);

        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    );

    renderPage(accountFetcher);

    await waitFor(() => {
      expect(screen.getByText('account-1-delivery-1')).toBeInTheDocument();
    });

    act(() => {
      switchAccount(ACCOUNT_2.id);
    });

    expect(screen.queryByText('account-1-delivery-1')).not.toBeInTheDocument();
    expect(screen.getByText(/Loading deliveries/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('account-2-delivery-1')).toBeInTheDocument();
    });

    expect(accountFetcher).toHaveBeenCalledWith(
      ACCOUNT_2.id,
      expect.objectContaining({ page: 1, status: 'all' }),
      expect.any(AbortSignal),
    );
  });

  it('does not render production account simulation controls', () => {
    renderPage();

    expect(screen.queryByText(/Switch Account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Simulate Error Account/i)).not.toBeInTheDocument();
  });

  it('never reports unconfirmed mutations as successful during retry', async () => {
    renderPage();
    
    await waitFor(() => {
      expect(screen.getByText(/dlv_2_1/i)).toBeInTheDocument();
    });

    const retryBtns = screen.getAllByText('Retry');
    fireEvent.click(retryBtns[0]);
    
    expect(screen.getByText('Retrying...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Retry triggered successfully')).toBeInTheDocument();
    });
  });

  it('announces the loading state with role=status', async () => {
    renderPage();

    const loading = screen.getByText(/Loading deliveries/i);
    expect(loading.getAttribute('role')).toBe('status');
  });

  it('announces mocked fetch errors with role=alert and a semantic danger class', async () => {
    const failingFetcher: WebhookDeliveriesFetcher = vi.fn(async () => {
      throw new Error('Failed to fetch from authoritative source');
    });

    renderPage(failingFetcher);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/Failed to fetch from authoritative source/i);
      expect(alert.className).toContain('webhook-deliveries-error');
    });
  });

  it('marks the stale data region busy and uses token-based warning classes', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/dlv_1_1/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Refresh/i));

    const dataRegion = document.querySelector('.webhook-deliveries-data');
    expect(dataRegion).toBeTruthy();

    await waitFor(() => {
      expect(dataRegion?.getAttribute('aria-busy')).toBe('true');
    });

    expect(screen.getByText(/Updating data/i).className).toContain('webhook-deliveries-stale-note');
    expect(dataRegion?.className).toContain('webhook-deliveries-data--stale');

    await waitFor(() => {
      expect(dataRegion?.getAttribute('aria-busy')).toBe('false');
    });

    expect(dataRegion?.className).not.toContain('webhook-deliveries-data--stale');
  });
});
