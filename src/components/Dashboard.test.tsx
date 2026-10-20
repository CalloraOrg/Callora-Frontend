// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard, { describeActivityAnnouncement } from './Dashboard';
import { LOADING_DELAY_MS } from '../config/constants';
import { pinnedApisStore } from '../state/pinnedApis';

describe('Dashboard', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    pinnedApisStore._reset();
    window.localStorage.removeItem('callora_pinned_apis');
  });

  it('renders the accessible usage gauge from recent usage activity and vault balance', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <Dashboard vaultBalance={50} walletBalance={10} openDeposit={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('progressbar', { name: 'API usage this cycle' })).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      'Within limit: 0 of 50 USDC used, 50 USDC remaining, 0% used.',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_DELAY_MS);
    });

    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      'Within limit: 12.5 of 50 USDC used, 37.5 USDC remaining, 25% used.',
    );
  });

  it('renders a pinned APIs section when APIs are pinned', () => {
    pinnedApisStore.pin('weather-001');

    render(
      <MemoryRouter>
        <Dashboard vaultBalance={100} walletBalance={20} openDeposit={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Pinned APIs')).toBeTruthy();
    expect(screen.getByText('WeatherSim API')).toBeTruthy();
    expect(screen.getByText('1 pinned')).toBeTruthy();
  });

  it('shows the pinned API empty state when nothing is pinned', () => {
    render(
      <MemoryRouter>
        <Dashboard vaultBalance={100} walletBalance={20} openDeposit={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Pinned APIs')).toBeTruthy();
    expect(screen.getByText('Pin APIs from the marketplace to keep them handy on your dashboard.')).toBeTruthy();
  });
});

describe('Dashboard reduced-motion & announcements', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function mockReducedMotion(reduce: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: reduce && (query === '(prefers-reduced-motion: reduce)' || query.includes('reduce')),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  it('bypasses the activity loading delay when prefers-reduced-motion is active', async () => {
    vi.useFakeTimers();
    mockReducedMotion(true);

    render(
      <MemoryRouter>
        <Dashboard vaultBalance={50} walletBalance={10} openDeposit={() => {}} />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(document.querySelector('.activity-list')).toBeTruthy();
    expect(screen.queryByText(/Loading recent activity/)).not.toBeInTheDocument();
  });

  it('keeps the normal activity loading delay when motion is not reduced', async () => {
    vi.useFakeTimers();
    mockReducedMotion(false);

    render(
      <MemoryRouter>
        <Dashboard vaultBalance={50} walletBalance={10} openDeposit={() => {}} />
      </MemoryRouter>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.queryByText(/Deposit:/)).not.toBeInTheDocument();
    expect(document.querySelector('.activity-skeletons')).toBeTruthy();
  });

  it('announces loading, then loaded activity state via a polite live region', async () => {
    vi.useFakeTimers();
    mockReducedMotion(false);

    render(
      <MemoryRouter>
        <Dashboard vaultBalance={50} walletBalance={10} openDeposit={() => {}} />
      </MemoryRouter>,
    );

    const liveRegion = screen.getByTestId('live-region-dashboard-activity');
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.textContent).toContain('Loading recent activity.');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_DELAY_MS);
    });

    expect(liveRegion.textContent).toContain('Recent activity loaded.');
  });

  it('marks the activity region busy while loading and clears it once loaded', async () => {
    vi.useFakeTimers();
    mockReducedMotion(false);

    render(
      <MemoryRouter>
        <Dashboard vaultBalance={50} walletBalance={10} openDeposit={() => {}} />
      </MemoryRouter>,
    );

    const activityRegion = document.querySelector('.dashboard-activity');
    expect(activityRegion?.getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_DELAY_MS);
    });

    expect(activityRegion?.getAttribute('aria-busy')).toBe('false');
  });

  it('exports an announcement helper covering loading, loaded, and empty states', () => {
    const activity = [
      { type: 'deposit' as const, amount: 50, date: new Date().toISOString() },
    ];
    expect(describeActivityAnnouncement(true, null)).toBe('Loading recent activity.');
    expect(describeActivityAnnouncement(false, activity)).toBe('Recent activity loaded.');
    expect(describeActivityAnnouncement(false, [])).toBe('No recent activity yet.');
    expect(describeActivityAnnouncement(false, null)).toBeUndefined();
  });
});
