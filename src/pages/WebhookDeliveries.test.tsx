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
});
