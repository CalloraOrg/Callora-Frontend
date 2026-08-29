// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
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
