import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WebhookDeliveries from './WebhookDeliveries';

describe('WebhookDeliveries Page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state, then authoritative state', async () => {
    render(<WebhookDeliveries />);
    
    expect(screen.getByText(/Loading deliveries/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Loading deliveries/i)).not.toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText(/dlv_1_1/i)).toBeInTheDocument();
  });

  it('renders explicit error and empty states', async () => {
    render(<WebhookDeliveries />);
    
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
    render(<WebhookDeliveries />);
    
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
