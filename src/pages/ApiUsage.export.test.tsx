import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ApiUsage from './ApiUsage';
import { switchAccount, addAccount, _reset } from '../state/accountStore';

vi.mock('../hooks/useFetchTracker', () => ({
  useFetchTracker: () => ({ trackFetch: vi.fn(async (promise) => promise) })
}));

vi.mock('../hooks/useQuota', () => ({
  useQuota: () => ({ usagePercent: 50, isDismissed: false, dismiss: vi.fn() })
}));

vi.mock('../components/PlanNudge', () => ({
  default: () => <div data-testid='plan-nudge'>PlanNudge</div>
}));

vi.mock('../components/CallsHeatmap', () => ({
  default: () => <div data-testid='calls-heatmap'>CallsHeatmap</div>
}));

describe('ApiUsage - Export Progress and Recovery Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _reset();
    addAccount({ id: 'acc_1', label: 'Account 1', apiKey: 'key_1' });
    addAccount({ id: 'acc_2', label: 'Account 2', apiKey: 'key_2' });
    switchAccount('acc_1');

    Object.defineProperty(window, 'location', {
      value: { search: '', pathname: '/api-usage' },
      writable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders export buttons and transitions through progress state to completion', async () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const exportCsvBtn = screen.getByRole('button', { name: 'Export CSV' });
    const exportJsonBtn = screen.getByRole('button', { name: 'Export JSON' });
    expect(exportCsvBtn).toBeInTheDocument();
    expect(exportJsonBtn).toBeInTheDocument();

    fireEvent.click(exportCsvBtn);

    expect(screen.getByRole('region', { name: 'Export progress' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(exportCsvBtn).toBeDisabled();
    expect(exportJsonBtn).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(screen.getByText(/Export Complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Again/i })).toBeInTheDocument();
  });

  it('allows user cancellation during active export', async () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const exportJsonBtn = screen.getByRole('button', { name: 'Export JSON' });
    fireEvent.click(exportJsonBtn);

    const cancelBtn = screen.getByRole('button', { name: /Cancel export/i });
    fireEvent.click(cancelBtn);

    expect(screen.getByText(/Export Cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/Export was cancelled by user/i)).toBeInTheDocument();
  });

  it('clears in-flight export state on account switch', async () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const exportCsvBtn = screen.getByRole('button', { name: 'Export CSV' });
    fireEvent.click(exportCsvBtn);

    expect(screen.getByRole('region', { name: 'Export progress' })).toBeInTheDocument();

    // Switch account
    act(() => {
      switchAccount('acc_2');
    });

    expect(screen.queryByRole('region', { name: 'Export progress' })).not.toBeInTheDocument();
  });
});
