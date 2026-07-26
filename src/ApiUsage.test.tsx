import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('should enable reset button when filters are active and announce reset to screen readers', async () => {
    render(<ApiUsage />);
    const resetButton = screen.getByRole('button', { name: /Reset Filters/i });
    expect(resetButton.disabled).toBe(true);
    const successTab = screen.getByRole('tab', { name: /Success/i });
    fireEvent.click(successTab);
    expect(resetButton.disabled).toBe(false);
    fireEvent.click(resetButton);
    expect(resetButton.disabled).toBe(true);
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

describe('ApiUsage - Tabular Numerals', () => {
  beforeEach(() => {
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
    vi.clearAllMocks();
  });

  it('applies tabular-nums to all stat-value elements', () => {
    render(<ApiUsage />);
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

describe('ApiUsage - Keyboard Shortcut Hints', () => {
  beforeEach(() => {
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
    vi.clearAllMocks();
  });

  it('renders the KbdHint component with ApiUsage shortcuts', () => {
    render(<ApiUsage />);
    const kbdHint = document.querySelector('.kbd-hint');
    expect(kbdHint).toBeTruthy();
    expect(kbdHint?.getAttribute('aria-label')).toBe('Keyboard shortcuts');
  });

  it('displays the make test call shortcut key', () => {
    render(<ApiUsage />);
    const kbdHint = document.querySelector('.kbd-hint');
    expect(kbdHint?.textContent).toContain('m');
    expect(kbdHint?.textContent).toContain('Make test call');
  });

  it('displays the toggle history shortcut key', () => {
    render(<ApiUsage />);
    const kbdHint = document.querySelector('.kbd-hint');
    expect(kbdHint?.textContent).toContain('h');
    expect(kbdHint?.textContent).toContain('Toggle request history');
  });

  it('displays the reset filters shortcut key', () => {
    render(<ApiUsage />);
    const kbdHint = document.querySelector('.kbd-hint');
    expect(kbdHint?.textContent).toContain('r');
    expect(kbdHint?.textContent).toContain('Reset call history filters');
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
 });
