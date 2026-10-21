import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebhookDeliveries from './WebhookDeliveries';
import { ToastProvider } from '../components/Toast';
import type { WebhookDeliveriesFetcher } from '../hooks/useWebhookDeliveries';
import { addAccount, switchAccount, _reset } from '../state/accountStore';

const ACCOUNT_1 = { id: 'account-1', label: 'Account 1', apiKey: 'ck_live_aaa' };
const ACCOUNT_2 = { id: 'account-2', label: 'Account 2', apiKey: 'ck_live_bbb' };

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

  describe('Responsive card layout below 640px (#1322)', () => {
    let originalMatchMedia: typeof window.matchMedia;

    const mockViewport = (isMobile: boolean) => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width: 639px') ? isMobile : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    };

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
      vi.restoreAllMocks();
    });

    // Scenario 1: Mobile media query -> articles rendered, no table
    it('renders expandable article cards and no table when below 640px', async () => {
      mockViewport(true);
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      // Verify relative timestamp inside a <time> element with absolute title
      const timeEls = document.querySelectorAll('article time');
      expect(timeEls.length).toBe(2);
      expect(timeEls[0].getAttribute('title')).toBeTruthy();
      expect(timeEls[0].getAttribute('datetime')).toBeTruthy();
    });

    // Scenario 2: Desktop -> table rendered with th[scope=col] x 7
    it('renders a table with 7 th[scope="col"] headers on desktop and no articles', async () => {
      mockViewport(false);
      const { container } = renderPage();

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      expect(screen.queryAllByRole('article')).toHaveLength(0);
      const scopedHeaders = container.querySelectorAll('table thead th[scope="col"]');
      expect(scopedHeaders).toHaveLength(7);
    });

    // Scenario 3: Details toggle -> aria-expanded flips; panel content visible
    it('toggles card Details disclosure and reveals stacked payload content', async () => {
      mockViewport(true);
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      const detailsButtons = screen.getAllByRole('button', { name: 'Details' });
      const firstToggle = detailsButtons[0];

      expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
      const controlsId = firstToggle.getAttribute('aria-controls');
      expect(controlsId).toBe('webhook-detail-dlv_1_1');
      expect(document.getElementById(controlsId!)).toBeNull();

      fireEvent.click(firstToggle);

      expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
      const detailPanel = document.getElementById(controlsId!);
      expect(detailPanel).toBeInTheDocument();
      expect(screen.getByText(/Response Status:/i)).toBeInTheDocument();
      expect(screen.getByText(/payment\.succeeded/i)).toBeInTheDocument();

      fireEvent.click(firstToggle);
      expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
      expect(document.getElementById(controlsId!)).toBeNull();
    });

    // Scenario 4: Retry on a failed card -> retryDelivery called once; button disabled while retrying
    it('disables Retry while retrying on a failed card and prevents double retry', async () => {
      mockViewport(true);
      const hooksModule = await import('../hooks/useWebhookDeliveries');
      const realUseWebhookDeliveries = hooksModule.useWebhookDeliveries;
      const retryCalls: string[] = [];

      vi.spyOn(hooksModule, 'useWebhookDeliveries').mockImplementation((accountId, fetcher) => {
        const result = realUseWebhookDeliveries(accountId, fetcher);
        return {
          ...result,
          retryDelivery: async (id: string) => {
            retryCalls.push(id);
            return result.retryDelivery(id);
          },
        };
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      expect(retryButton).not.toBeDisabled();

      // Trigger retry and verify the button becomes disabled while in-flight
      fireEvent.click(retryButton);

      const retryingButton = screen.getByRole('button', { name: 'Retrying...' });
      expect(retryingButton).toBeDisabled();

      // A second click while retrying must not trigger a duplicate retry
      fireEvent.click(retryingButton);
      expect(retryCalls).toEqual(['dlv_2_1']);

      await waitFor(() => {
        expect(screen.getByText('Retry triggered successfully')).toBeInTheDocument();
      });
    });

    // Scenario 5: Delivered card -> no Retry button
    it('does not render a Retry button on delivered cards', async () => {
      mockViewport(true);
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      const deliveredCard = screen.getByRole('article', { name: 'Delivery dlv_1_1' });
      const failedCard = screen.getByRole('article', { name: 'Delivery dlv_2_1' });

      expect(deliveredCard.querySelector('.webhook-delivery-card__retry-btn')).toBeNull();
      expect(failedCard.querySelector('.webhook-delivery-card__retry-btn')).toBeInTheDocument();
    });

    // Scenario 6: Long URL (300 chars) -> accessible name contains the full URL; visible text truncated
    it('truncates visible text for a 300-character URL while preserving the full URL in title and accessible name', async () => {
      mockViewport(true);
      const longPath = '/webhooks/' + 'a'.repeat(270);
      const longUrl = `https://hooks.acme-labs.dev${longPath}`;
      expect(longUrl.length).toBeGreaterThanOrEqual(300);

      const longUrlFetcher: WebhookDeliveriesFetcher = vi.fn(async () => ({
        data: [
          {
            id: 'dlv_long_1',
            url: longUrl,
            status: 'delivered',
            attempts: 1,
            lastAttemptAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        totalCount: 1,
      }));

      renderPage(longUrlFetcher);

      await waitFor(() => {
        expect(screen.getByRole('article', { name: 'Delivery dlv_long_1' })).toBeInTheDocument();
      });

      const urlEl = screen.getByLabelText(longUrl);
      expect(urlEl).toBeInTheDocument();
      expect(urlEl.getAttribute('title')).toBe(longUrl);
      expect(urlEl.textContent).toContain('hooks.acme-labs.dev/webhooks/');
      expect(urlEl.textContent).toContain('…');
      expect((urlEl.textContent ?? '').length).toBeLessThan(longUrl.length);
    });

    // Scenario 7: JSON block -> focusable with an accessible label
    it('renders JSON payload blocks inside focusable containers with accessible labels', async () => {
      mockViewport(true);
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);

      const requestRegion = screen.getByRole('region', { name: 'Request body JSON for dlv_1_1' });
      const responseRegion = screen.getByRole('region', { name: 'Response body JSON for dlv_1_1' });

      expect(requestRegion).toHaveAttribute('tabindex', '0');
      expect(responseRegion).toHaveAttribute('tabindex', '0');
    });

    // Scenario 8: Status filter at mobile -> filters cards as on desktop
    it('filters cards by status on mobile just like on desktop', async () => {
      mockViewport(true);
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('article')).toHaveLength(2);
      });

      const statusSelect = screen.getByLabelText(/Status/i);
      fireEvent.change(statusSelect, { target: { value: 'failed' } });

      await waitFor(() => {
        const cards = screen.getAllByRole('article');
        expect(cards).toHaveLength(1);
        expect(cards[0]).toHaveAttribute('aria-label', 'Delivery dlv_2_1');
      });
    });
  });
});
