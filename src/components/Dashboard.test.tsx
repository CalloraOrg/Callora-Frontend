// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { LOADING_DELAY_MS } from '../config/constants';

describe('Dashboard', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
});
