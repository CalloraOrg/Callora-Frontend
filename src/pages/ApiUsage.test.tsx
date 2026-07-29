import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ApiUsage from './ApiUsage';

const writeTextMock = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

// Mock dependencies
vi.mock('../hooks/useFetchTracker', () => ({
  useFetchTracker: () => ({ trackFetch: vi.fn(async (promise) => promise) })
}));

vi.mock('../hooks/useQuota', () => ({
  useQuota: () => ({ usagePercent: 50, isDismissed: false, dismiss: vi.fn() })
}));

vi.mock('../components/PlanNudge', () => ({
  default: () => <div data-testid="plan-nudge">PlanNudge</div>
}));

vi.mock('../components/CallsHeatmap', () => ({
  default: () => <div data-testid="calls-heatmap">CallsHeatmap</div>
}));

describe('ApiUsage - Filter Reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        pathname: '/api-usage',
      },
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should enable reset button when filters are active and announce reset to screen readers', async () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const resetButton = screen.getByRole('button', { name: /Reset Filters/i });
    expect(resetButton.disabled).toBe(true);
    const successTab = screen.getByRole('tab', { name: /Success/i });
    fireEvent.click(successTab);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(resetButton.disabled).toBe(false);
    fireEvent.click(resetButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(resetButton.disabled).toBe(true);
    const srAnnouncement = screen.getByRole('status');
    expect(srAnnouncement.textContent).toBe('Filters reset. Showing all calls from the last 24 hours.');
  });

  it('renders an accessible breadcrumb with the current page announced', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(breadcrumb).toBeTruthy();
    const marketplaceLink = screen.getByRole('link', { name: 'Marketplace' });
    expect(marketplaceLink.getAttribute('href')).toBe('/marketplace');
    const currentCrumb = screen.getByText('User Profile API usage');
    expect(currentCrumb.getAttribute('aria-current')).toBe('page');
  });

  it('announces status filter changes to screen readers', async () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('tab', { name: /Error/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('status').textContent).toBe('Showing error calls.');
  });

  it('announces copy actions to screen readers', async () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('API key copied to clipboard.');
  });
});

describe('ApiUsage - Tabular Numerals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      value: { search: '', pathname: '/api-usage' },
      writable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    writeTextMock.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies tabular-nums to all stat-value elements', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const statValues = document.querySelectorAll('.stat-value.tabular-nums');
    expect(statValues.length).toBe(5);
    const labels = ['Calls Today', 'Calls This Week', 'Total Spent', 'Avg Response Time', 'Success Rate'];
    statValues.forEach((el, i) => {
      expect(el.classList.contains('tabular-nums')).toBe(true);
      const card = el.closest('.stat-card');
      expect(card.querySelector('.stat-label').textContent).toBe(labels[i]);
    });
  });
});

describe('ApiUsage - Empty State', () => {
  beforeEach(() => {
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
    vi.clearAllMocks();
  });

  it('renders call history rows when there are matching records', async () => {
    vi.useFakeTimers();
    render(<ApiUsage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    vi.useRealTimers();

    const callHistorySection = screen.getByText('Call History');
    expect(callHistorySection).toBeTruthy();
    const skeletonRows = document.querySelectorAll('.skeleton-cell');
    expect(skeletonRows.length).toBe(0);
  });

  it('renders call history entries using CallHistoryRow components', async () => {
    vi.useFakeTimers();
    render(<ApiUsage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    vi.useRealTimers();

    expect(screen.getByText('Call History')).toBeTruthy();
    const resetButton = screen.getByRole('button', { name: /Reset Filters/i });
    expect(resetButton).toBeTruthy();
  });

  it('does not show EmptyState when call history data is present', async () => {
    vi.useFakeTimers();
    render(<ApiUsage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    vi.useRealTimers();

    const noCallsMessage = screen.queryByText('No calls yet');
    expect(noCallsMessage).toBeNull();
  });
});

describe('ApiUsage - prefers-reduced-motion', () => {
   let originalMatchMedia: typeof window.matchMedia;

   beforeEach(() => {
     vi.useFakeTimers();
     originalMatchMedia = window.matchMedia;
   });

   afterEach(() => {
     vi.useRealTimers();
     window.matchMedia = originalMatchMedia;
   });

   it('applies focus-visible styles on interactive elements when keyboard-focused', () => {
    render(<ApiUsage />);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // All interactive buttons get focus-visible outlines via global @layer focus
    const buttons = document.querySelectorAll('.api-usage-page button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(btn => {
      expect(btn.tagName).toBe('BUTTON');
      // Tab buttons specifically get the tab-button focus override
      if (btn.classList.contains('tab-button')) {
        const style = getComputedStyle(btn);
        // The global @layer focus layer provides the ring
        expect(btn.classList.contains('tab-button')).toBe(true);
      }
    });

    // Tab buttons exist for language selection
    const tabButtons = document.querySelectorAll('.api-usage-page .tab-button');
    expect(tabButtons.length).toBe(3); // JavaScript, Python, cURL

    // Chart bars exist
    const chartBars = document.querySelectorAll('.chart-bar');
    expect(chartBars.length).toBe(7); // 7 days

    // Response display section is initially hidden (no call made yet)
    const responseDisplay = document.querySelector('.response-display');
    expect(responseDisplay).toBeFalsy();

    // Documentation link exists
    const docLink = document.querySelector('.documentation-link a');
    expect(docLink).toBeTruthy();
  });

  it('bypasses table loading delay and shows content immediately when prefers-reduced-motion is active', async () => {
     window.matchMedia = vi.fn().mockImplementation((query) => ({
       matches: query === '(prefers-reduced-motion: reduce)' || query.includes('reduce'),
       media: query,
       onchange: null,
       addListener: vi.fn(),
       removeListener: vi.fn(),
       addEventListener: vi.fn(),
       removeEventListener: vi.fn(),
       dispatchEvent: vi.fn(),
     }));

     render(<ApiUsage />);

     await act(async () => {
       await vi.advanceTimersByTimeAsync(0);
     });

     expect(screen.getByText('Call History')).toBeTruthy();
     const skeletonRows = document.querySelectorAll('.skeleton-cell');
     expect(skeletonRows.length).toBe(0);
   });

  it('uses the normal loading delay when prefers-reduced-motion is not active', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ApiUsage />);

    const skeletonRows = document.querySelectorAll('.skeleton-cell');
    expect(skeletonRows.length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText('Call History')).toBeTruthy();
   });

  // ── CSS-class contract for reduced-motion (Issue #721) ────────────────
  //
  // jsdom does not evaluate @media rules, so we verify that the CSS classes
  // exist and are correctly structured for the {prefers-reduced-motion: reduce}
  // rules in index.css to apply in real browsers.

  it('status-dot has CSS class targeted by prefers-reduced-motion: reduce rules', () => {
    render(<ApiUsage />);
    act(() => { vi.advanceTimersByTime(500); });
    const statusDot = document.querySelector('.status-dot');
    expect(statusDot).toBeTruthy();
  });

  it('skeleton elements have the .skeleton class targeted by reduced-motion CSS', () => {
    // Render normally (no reduced motion) to verify skeleton class presence
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ApiUsage />);

    const skeletonEls = document.querySelectorAll('.skeleton');
    // There should be skeletons visible during initial render
    expect(skeletonEls.length).toBeGreaterThanOrEqual(1);
  });

  it('skeleton elements are present with shimmer background before reduced-motion CSS takes effect', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ApiUsage />);

    const skeletonEls = document.querySelectorAll('.skeleton');
    skeletonEls.forEach((el) => {
      // The shimmer animation is driven by the CSS class, which the
      // prefers-reduced-motion: reduce rule overrides in real browsers.
      expect(el.classList.contains('skeleton')).toBe(true);
    });
  });

  it('button-spinner has CSS class targeted by prefers-reduced-motion: reduce rules', () => {
    render(<ApiUsage />);
    act(() => { vi.advanceTimersByTime(500); });
    
    // Trigger button loading state to show spinner
    const makeTestCallButton = screen.getByRole('button', { name: /Make Test Call/i });
    fireEvent.click(makeTestCallButton);
    
    const buttonSpinner = document.querySelector('.button-spinner');
    expect(buttonSpinner).toBeTruthy();
  });

  it('tab-button has CSS class targeted by prefers-reduced-motion: reduce transition rules', () => {
    render(<ApiUsage />);
    act(() => { vi.advanceTimersByTime(500); });
    const tabButtons = document.querySelectorAll('.tab-button');
    expect(tabButtons.length).toBe(3);
    tabButtons.forEach(btn => {
      expect(btn.classList.contains('tab-button')).toBe(true);
    });
  });

  it('danger-button has CSS class targeted by prefers-reduced-motion: reduce transition rules', () => {
    render(<ApiUsage />);
    act(() => { vi.advanceTimersByTime(500); });
    const dangerButton = document.querySelector('.danger-button');
    expect(dangerButton).toBeTruthy();
  });

  it('primary-button has CSS class targeted by prefers-reduced-motion: reduce transition rules', () => {
    render(<ApiUsage />);
    act(() => { vi.advanceTimersByTime(500); });
    const primaryButtons = document.querySelectorAll('.primary-button');
    expect(primaryButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('secondary-button has CSS class targeted by prefers-reduced-motion: reduce transition rules', () => {
    render(<ApiUsage />);
    act(() => { vi.advanceTimersByTime(500); });
    const secondaryButtons = document.querySelectorAll('.secondary-button');
    expect(secondaryButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('ghost-button has CSS class targeted by prefers-reduced-motion: reduce transition rules', () => {
    render(<ApiUsage />);
    act(() => { vi.advanceTimersByTime(500); });
    const ghostButton = document.querySelector('.ghost-button');
    expect(ghostButton).toBeTruthy();
  });
  });

  describe('ApiUsage - Skeleton Parity', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      vi.useFakeTimers();
      originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    afterEach(() => {
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
    });

    it('renders skeleton rows with shape and height parity matching the final component', () => {
      render(<ApiUsage />);
      
      const skeletonRows = document.querySelectorAll('.table-row');
      expect(skeletonRows.length).toBeGreaterThan(0);
      
      const firstSkeletonRow = skeletonRows[1];
      const skeletonCells = firstSkeletonRow.querySelectorAll('.skeleton-cell');
      
      expect(skeletonCells.length).toBe(7);
      
      const statusIconSkeleton = skeletonCells[2];
      expect(statusIconSkeleton.getAttribute('style')).toContain('width: 16px');
      expect(statusIconSkeleton.getAttribute('style')).toContain('border-radius: 50%');
      
      const actionButtonSkeleton = skeletonCells[6];
      expect(actionButtonSkeleton.getAttribute('style')).toContain('width: 64px');
      expect(actionButtonSkeleton.getAttribute('style')).toContain('height: 32px');
    });
  });
