// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardOverview from './DashboardOverview';
import { pinnedApisStore } from '../state/pinnedApis';
import MOCK_APIS from '../data/mockApis';

function renderOverview(props = {}) {
  return render(
    <MemoryRouter>
      <DashboardOverview {...props} />
    </MemoryRouter>,
  );
}

// ─── Core rendering ───────────────────────────────────────────────────────────

describe('DashboardOverview — core rendering (#581)', () => {
  afterEach(cleanup);

  it('renders vault balance and wallet available overview cards', () => {
    renderOverview({ vaultBalance: 120, walletBalance: 300 });

    expect(screen.getByText('Vault balance')).toBeTruthy();
    expect(screen.getByText('120.00 USDC')).toBeTruthy();
    expect(screen.getByText('Wallet available')).toBeTruthy();
    expect(screen.getByText('300.00 USDC')).toBeTruthy();
  });

  it('renders quick action buttons', () => {
    const handleDeposit = vi.fn();
    renderOverview({ openDeposit: handleDeposit });

    const depositBtn = screen.getByRole('button', { name: /^Deposit$/i });
    expect(depositBtn).toBeTruthy();

    fireEvent.click(depositBtn);
    expect(handleDeposit).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('button', { name: /Quick top-up with 50 USDC/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Quick top-up with 100 USDC/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Browse APIs/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /View Usage/i })).toBeTruthy();
  });

  it('passes the preset amount to openDeposit when a quick top-up is clicked', () => {
    const handleDeposit = vi.fn();
    renderOverview({ openDeposit: handleDeposit });

    fireEvent.click(screen.getByRole('button', { name: /Quick top-up with 50 USDC/i }));
    expect(handleDeposit).toHaveBeenCalledWith(50);

    fireEvent.click(screen.getByRole('button', { name: /Quick top-up with 100 USDC/i }));
    expect(handleDeposit).toHaveBeenCalledWith(100);
  });
});

// ─── PreviewCard integration: balance cards ───────────────────────────────────

describe('DashboardOverview — PreviewCard on balance cards (#581)', () => {
  afterEach(cleanup);

  it('wraps Vault Balance card in a PreviewCard trigger', () => {
    renderOverview();

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });
    expect(vaultTrigger).toBeTruthy();

    fireEvent.focus(vaultTrigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip).toHaveTextContent('USDC Vault Overview');
    expect(tooltip).toHaveTextContent('Callora Stellar Vault Settlement Account');
  });

  it('shows vault metrics (Available and Est. Runway) inside the preview', () => {
    renderOverview({ vaultBalance: 200, costPerCall: 0.01, callsPerDay: 100 });

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });
    fireEvent.focus(vaultTrigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Available');
    expect(tooltip).toHaveTextContent('Est. Runway');
  });

  it('shows a warning status on vault preview when balance is low (< 20 USDC)', () => {
    renderOverview({ vaultBalance: 15 });

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });
    fireEvent.focus(vaultTrigger);

    // status badge aria-label is "Degraded" for the warning variant
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
  });

  it('wraps Wallet Available card in a PreviewCard trigger', () => {
    renderOverview();

    const walletTrigger = screen.getByRole('button', {
      name: /preview details for connected wallet/i,
    });
    expect(walletTrigger).toBeTruthy();

    fireEvent.focus(walletTrigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip).toHaveTextContent('Freighter Stellar Wallet');
  });

  it('sets aria-describedby on vault trigger to the tooltip id while open', () => {
    renderOverview();

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });

    // Initially no aria-describedby
    expect(vaultTrigger.getAttribute('aria-describedby')).toBeNull();

    fireEvent.focus(vaultTrigger);
    const tooltip = screen.getByRole('tooltip');
    expect(vaultTrigger.getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  it('closes preview card when Escape key is pressed on trigger', () => {
    renderOverview();

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });

    fireEvent.focus(vaultTrigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(vaultTrigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens vault preview on mouseEnter and hides on mouseLeave', () => {
    const { container } = renderOverview();

    // The outermost .preview-card__wrapper for vault is the first one rendered
    const wrappers = container.querySelectorAll('.preview-card__wrapper');
    expect(wrappers.length).toBeGreaterThanOrEqual(1);

    const vaultWrapper = wrappers[0] as HTMLElement;
    fireEvent.mouseEnter(vaultWrapper);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(vaultWrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

// ─── PreviewCard integration: pinned APIs ────────────────────────────────────

describe('DashboardOverview — PreviewCard on pinned API rows (#581)', () => {
  beforeEach(() => {
    pinnedApisStore._reset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    pinnedApisStore._reset();
    vi.useRealTimers();
    cleanup();
  });

  /**
   * Helper: renders the overview then immediately flushes the activity-load
   * setTimeout so React never fires a state update outside act().
   */
  async function renderAndFlush(props = {}) {
    let result: ReturnType<typeof renderOverview>;
    await act(async () => {
      result = renderOverview(props);
      vi.runAllTimers();
    });
    return result!;
  }

  it('shows a PreviewCard trigger for each pinned API row', async () => {
    pinnedApisStore.pin(MOCK_APIS[0].id);
    await renderAndFlush();

    const trigger = screen.getByRole('button', {
      name: new RegExp(`preview details for ${MOCK_APIS[0].name}`, 'i'),
    });
    expect(trigger).toBeTruthy();
  });

  it('reveals API name and provider in pinned API preview tooltip', async () => {
    const api = MOCK_APIS[0]; // WeatherSim API — provider: "Acme Labs"
    pinnedApisStore.pin(api.id);
    await renderAndFlush();

    const trigger = screen.getByRole('button', {
      name: new RegExp(`preview details for ${api.name}`, 'i'),
    });
    fireEvent.focus(trigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent(api.name);
    expect(tooltip).toHaveTextContent(api.provider.name);
  });

  it('shows latency and uptime metrics from api.avgLatencyMs (not api.latencyMs)', async () => {
    // Regression guard for the api.latencyMs → api.avgLatencyMs bug fix.
    const api = MOCK_APIS[0]; // avgLatencyMs: 180 in mock data
    pinnedApisStore.pin(api.id);
    await renderAndFlush();

    const trigger = screen.getByRole('button', {
      name: new RegExp(`preview details for ${api.name}`, 'i'),
    });
    fireEvent.focus(trigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Latency');
    expect(tooltip).toHaveTextContent('Uptime');
  });

  it('closes pinned API preview on Escape', async () => {
    const api = MOCK_APIS[0];
    pinnedApisStore.pin(api.id);
    await renderAndFlush();

    const trigger = screen.getByRole('button', {
      name: new RegExp(`preview details for ${api.name}`, 'i'),
    });
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the unpin button inside the pinned API row', async () => {
    const api = MOCK_APIS[0];
    pinnedApisStore.pin(api.id);
    await renderAndFlush();

    expect(
      screen.getByRole('button', { name: new RegExp(`Unpin ${api.name}`, 'i') }),
    ).toBeTruthy();
  });

  it('removes API from pinned list when Unpin is clicked', async () => {
    const api = MOCK_APIS[0];
    pinnedApisStore.pin(api.id);
    await renderAndFlush();

    const unpinBtn = screen.getByRole('button', {
      name: new RegExp(`Unpin ${api.name}`, 'i'),
    });
    await act(async () => { fireEvent.click(unpinBtn); });

    expect(screen.queryByTestId(`pinned-api-${api.id}`)).toBeNull();
  });

  it('renders "no pinned APIs" copy when pin list is empty', async () => {
    await renderAndFlush();
    expect(screen.getByText(/Pin APIs from the marketplace/i)).toBeTruthy();
  });
});

// ─── PreviewCard integration: recent activity items ──────────────────────────

describe('DashboardOverview — PreviewCard on activity items (#581)', () => {
  afterEach(cleanup);

  it('shows activity item skeletons while loading', () => {
    // Activity loads after LOADING_DELAY_MS; without fake timers it is pending.
    renderOverview();
    const skeletons = document.querySelectorAll('.activity-skeletons');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders activity items with PreviewCard wrappers after load', async () => {
    vi.useFakeTimers();
    renderOverview();

    // Advance past the loading delay (constants.ts LOADING_DELAY_MS = 800 ms)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    vi.useRealTimers();

    // Expect at least one activity item to appear
    await waitFor(() => {
      expect(screen.queryAllByTestId(/activity-item-act-/).length).toBeGreaterThan(0);
    });

    // Each activity item should have a PreviewCard trigger wrapping it
    const activityTriggers = screen.queryAllByRole('button', {
      name: /preview details for (usdc deposit|api request charge)/i,
    });
    expect(activityTriggers.length).toBeGreaterThan(0);
  });

  it('shows activity preview tooltip with amount and type metrics after load', async () => {
    vi.useFakeTimers();
    renderOverview();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.queryAllByTestId(/activity-item-act-/).length).toBeGreaterThan(0);
    });

    const triggers = screen.queryAllByRole('button', {
      name: /preview details for (usdc deposit|api request charge)/i,
    });

    if (triggers.length > 0) {
      fireEvent.focus(triggers[0]);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Amount');
      expect(tooltip).toHaveTextContent('USDC');
    }
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe('DashboardOverview — accessibility (WCAG 2.1 AA, #581)', () => {
  afterEach(cleanup);

  it('all PreviewCard triggers have an accessible aria-label', () => {
    renderOverview();

    // Every PreviewCard trigger must have an aria-label matching "Preview details for …"
    const triggers = screen.queryAllByRole('button', {
      name: /preview details for/i,
    });
    expect(triggers.length).toBeGreaterThanOrEqual(2); // vault + wallet at minimum
    triggers.forEach((trigger) => {
      expect(trigger.getAttribute('aria-label')).toMatch(/preview details for/i);
    });
  });

  it('PreviewCard trigger has tabIndex=0 (keyboard reachable)', () => {
    renderOverview();

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });
    expect(vaultTrigger.getAttribute('tabindex')).toBe('0');
  });

  it('preview panel has role="tooltip" for screen reader announcement', () => {
    renderOverview();

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });
    fireEvent.focus(vaultTrigger);

    const panel = screen.getByRole('tooltip');
    expect(panel).toBeTruthy();
  });

  it('aria-describedby is cleared after Escape dismissal', () => {
    renderOverview();

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });

    fireEvent.focus(vaultTrigger);
    expect(vaultTrigger.getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.keyDown(vaultTrigger, { key: 'Escape' });
    expect(vaultTrigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('renders a section with the dashboard-overview-container class', () => {
    const { container } = renderOverview();
    expect(container.querySelector('.dashboard-overview-container')).toBeTruthy();
  });
});

// ─── Balances: loading, failed, and known states ─────────────────────────────

describe('DashboardOverview — balance request states', () => {
  afterEach(cleanup);

  it('renders a loading skeleton instead of a fabricated zero while balances load', () => {
    renderOverview({ vaultBalance: null, walletBalance: null, balancesStatus: 'loading' });

    expect(screen.getByTestId('vault-balance-loading')).toBeTruthy();
    expect(screen.getByTestId('wallet-balance-loading')).toBeTruthy();
    expect(screen.getByTestId('dashboard-card-vault').getAttribute('data-balance-state')).toBe('loading');
    expect(screen.queryByText(/0\.00 USDC/)).toBeNull();
    expect(screen.queryByTestId('vault-balance-error')).toBeNull();
  });

  it('derives the loading state when null balances arrive without an explicit status', () => {
    renderOverview({ vaultBalance: null, walletBalance: null });

    expect(screen.getByTestId('dashboard-card-vault').getAttribute('data-balance-state')).toBe('loading');
  });

  it('renders an inline retry and the failure reason when the request failed', () => {
    renderOverview({
      vaultBalance: null,
      walletBalance: null,
      balancesStatus: 'error',
      balancesError: 'The balances service responded with 503.',
    });

    expect(screen.getByTestId('vault-balance-error')).toBeTruthy();
    expect(screen.getByTestId('wallet-balance-error')).toBeTruthy();
    expect(screen.getAllByText('The balances service responded with 503.').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Retry$/i }).length).toBeGreaterThan(0);
  });

  it('never renders $0.00 for an unknown balance', () => {
    renderOverview({ vaultBalance: null, walletBalance: null, balancesStatus: 'error' });

    expect(screen.getByTestId('dashboard-card-vault').textContent).not.toContain('0.00');
    expect(screen.getByTestId('dashboard-card-wallet').textContent).not.toContain('0.00');
  });

  it('falls back to a default message when no error text is supplied', () => {
    renderOverview({ vaultBalance: null, walletBalance: null, balancesStatus: 'error' });

    expect(screen.getAllByText(/balances could not be loaded/i).length).toBeGreaterThan(0);
  });

  it('invokes onRetryBalances when the inline retry is clicked', () => {
    const onRetry = vi.fn();
    renderOverview({
      vaultBalance: null,
      walletBalance: null,
      balancesStatus: 'error',
      onRetryBalances: onRetry,
    });

    fireEvent.click(screen.getAllByRole('button', { name: /^Retry$/i })[0]);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not crash when retry is pressed without a retry handler', () => {
    renderOverview({ vaultBalance: null, walletBalance: null, balancesStatus: 'error' });

    expect(() => fireEvent.click(screen.getAllByRole('button', { name: /^Retry$/i })[0])).not.toThrow();
  });

  it('hides the low-balance banner while balances are loading', () => {
    renderOverview({ vaultBalance: null, walletBalance: null, balancesStatus: 'loading' });

    expect(screen.queryByText(/Low balance warning/i)).toBeNull();
  });

  it('hides the low-balance banner when the request failed', () => {
    renderOverview({ vaultBalance: null, walletBalance: null, balancesStatus: 'error' });

    expect(screen.queryByText(/Low balance warning/i)).toBeNull();
  });

  it('shows the low-balance banner when the fetched balance is genuinely low', () => {
    renderOverview({ vaultBalance: 2, walletBalance: 500, balancesStatus: 'ready' });

    expect(screen.getByText(/Low balance warning/i)).toBeTruthy();
    expect(screen.getByText('2.00 USDC')).toBeTruthy();
  });

  it('renders the fetched balances once ready', () => {
    renderOverview({ vaultBalance: 91.5, walletBalance: 120.25, balancesStatus: 'ready' });

    expect(screen.getByTestId('dashboard-card-vault').textContent).toContain('91.50 USDC');
    expect(screen.getByTestId('dashboard-card-wallet').textContent).toContain('120.25 USDC');
  });

  it('replaces the usage gauge with a placeholder while balances are unknown', () => {
    renderOverview({ vaultBalance: null, walletBalance: null, balancesStatus: 'loading' });

    expect(screen.getByTestId('usage-gauge-unavailable')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('restores the usage gauge when balances resolve', () => {
    renderOverview({ vaultBalance: 500, walletBalance: 100, balancesStatus: 'ready' });

    expect(screen.queryByTestId('usage-gauge-unavailable')).toBeNull();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('keeps a real zero balance visible in the preview tooltip', () => {
    renderOverview({ vaultBalance: 0, walletBalance: 0, balancesStatus: 'ready' });

    const vaultTrigger = screen.getByRole('button', {
      name: /preview details for usdc vault overview/i,
    });
    fireEvent.focus(vaultTrigger);

    expect(screen.getByRole('tooltip')).toHaveTextContent('0.00 USDC');
  });
});
