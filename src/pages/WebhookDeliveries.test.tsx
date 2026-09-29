import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WebhookDeliveries from './WebhookDeliveries';
import { ToastProvider } from '../components/Toast';

describe('WebhookDeliveries Page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The toast provider is mounted at the app root (main.tsx); retry
  // feedback uses the useToast context, so tests wrap the page in it.
  const renderPage = () => render(
    <ToastProvider>
      <WebhookDeliveries />
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

  it('renders explicit error and empty states', async () => {
    renderPage();
    
    const errorBtn = screen.getByText(/Simulate Error Account/i);
    fireEvent.click(errorBtn);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch from authoritative source/i)).toBeInTheDocument();
    });

    const switchBtn = screen.getByText(/Switch Account/i);
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(screen.getByText(/dlv_1_1/i)).toBeInTheDocument();
    });
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

  it('announces errors with role=alert and a semantic danger class', async () => {
    renderPage();

    fireEvent.click(screen.getByText(/Simulate Error Account/i));

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
