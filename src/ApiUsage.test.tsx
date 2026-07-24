import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ApiUsage from './ApiUsage';

// Mock dependencies
vi.mock('./hooks/useFetchTracker', () => ({
  useFetchTracker: () => ({ trackFetch: vi.fn(async (promise) => promise) })
}));

vi.mock('./hooks/useQuota', () => ({
  useQuota: () => ({ usagePercent: 50, isDismissed: false, dismiss: vi.fn() })
}));

vi.mock('./components/PlanNudge', () => ({
  default: () => <div data-testid="plan-nudge">PlanNudge</div>
}));

vi.mock('./components/CallsHeatmap', () => ({
  default: () => <div data-testid="calls-heatmap">CallsHeatmap</div>
}));

describe('ApiUsage - Filter Reset', () => {
  beforeEach(() => {
    // Reset window.location
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        pathname: '/api-usage',
      },
      writable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
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
    vi.clearAllMocks();
  });

  it('should enable reset button when filters are active and announce reset to screen readers', async () => {
    render(<ApiUsage />);
    
    const resetButton = screen.getByRole('button', { name: /Reset Filters/i });
    expect((resetButton as HTMLButtonElement).disabled).toBe(true);

    // Change a filter to activate the reset button
    const successTab = screen.getByRole('tab', { name: /Success/i });
    fireEvent.click(successTab);

    expect((resetButton as HTMLButtonElement).disabled).toBe(false);

    // Reset filters
    fireEvent.click(resetButton);

    // Verify filters are reset
    expect((resetButton as HTMLButtonElement).disabled).toBe(true);
    
    // Verify screen reader announcement
    const srAnnouncement = screen.getByRole('status');
    expect(srAnnouncement.textContent).toBe('Filters reset. Showing all calls from the last 24 hours.');
  });

  it('renders an accessible breadcrumb with the current page announced', () => {
    render(<ApiUsage />);

    const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumb).toBeTruthy();

    const marketplaceLink = screen.getByRole('link', { name: 'Marketplace' });
    expect(marketplaceLink.getAttribute('href')).toBe('/marketplace');

    const currentCrumb = screen.getByText('User Profile API usage');
    expect(currentCrumb.getAttribute('aria-current')).toBe('page');
  });
});
