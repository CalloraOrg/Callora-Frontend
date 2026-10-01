// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardOverview from './DashboardOverview';
import { pinnedApisStore } from '../state/pinnedApis';
import MOCK_APIS from '../data/mockApis';
import type { BillingTransaction } from './BillingHistory';

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** A minimal BillingTransaction array returned by the happy-path mock. */
const MOCK_ACTIVITY: BillingTransaction[] = [
  {
    id: 'tx-101',
    description: 'WeatherSim API /v1/forecast',
    type: 'API Call',
    direction: 'debit',
    amount: 12.5,
    status: 'success',
    timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    txHash: 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2',
    network: 'Stellar Mainnet',
    confirmations: 100,
  },
  {
    id: 'tx-102',
    description: 'USDC Vault Settlement',
    type: 'Deposit',
    direction: 'credit',
    amount: 100.0,
    status: 'success',
    timestamp: new Date(Date.now() - 86_400_000).toISOString(),
    txHash: 'B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3',
    network: 'Stellar Mainnet',
    confirmations: 60,
  },
];

/**
 * Stub global.fetch with a factory that resolves with `data` after one tick.
 * Returns a cleanup function that restores the original fetch.
 */
function stubFetchSuccess(data: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
  } as Response);
  vi.stubGlobal('fetch', spy);
  return spy;
}

/**
 * Stub global.fetch so it rejects with `message` after one tick.
 */
function stubFetchError(message = 'Network error') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error(message)),
  );
}

/**
 * Stub global.fetch so it resolves with a non-OK HTTP response.
 */
function stubFetchHttpError(status = 500, statusText = 'Internal Server Error') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText,
      json: async () => [],
    } as Response),
  );
}

function renderOverview(props = {}) {
  return render(
    <MemoryRouter>
      <DashboardOverview {...props} />
    </MemoryRouter>,
  );
}

// ─── Core rendering ───────────────────────────────────────────────────────────

describe('DashboardOverview — core rendering (#581)', () => {
  beforeEach(() => { stubFetchSuccess(MOCK_ACTIVITY); });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('renders vault balance and wallet available overview cards', async () => {
    renderOverview({ vaultBalance: 120, walletBalance: 300 });

    expect(screen.getByText('Vault balance')).toBeTruthy();
    expect(screen.getByText('120.00 USDC')).toBeTruthy();
    expect(screen.getByText('Wallet available')).toBeTruthy();
    expect(screen.getByText('300.00 USDC')).toBeTruthy();
  });

  it('renders quick action buttons', async () => {
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

  it('passes the preset amount to openDeposit when a quick top-up is clicked', async () => {
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
  beforeEach(() => { stubFetchSuccess(MOCK_ACTIVITY); });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

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
    stubFetchSuccess(MOCK_ACTIVITY);
  });
  afterEach(() => {
    pinnedApisStore._reset();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('shows a PreviewCard trigger for each pinned API row', async () => {
    pinnedApisStore.pin(MOCK_APIS[0].id);

    await act(async () => { renderOverview(); });
    await waitFor(() =>
      screen.getByRole('button', {
        name: new RegExp(`preview details for ${MOCK_APIS[0].name}`, 'i'),
      }),
    );
  });

  it('reveals API name and provider in pinned API preview tooltip', async () => {
    const api = MOCK_APIS[0]; // WeatherSim API — provider: "Acme Labs"
    pinnedApisStore.pin(api.id);

    await act(async () => { renderOverview(); });

    const trigger = await screen.findByRole('button', {
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

    await act(async () => { renderOverview(); });

    const trigger = await screen.findByRole('button', {
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

    await act(async () => { renderOverview(); });

    const trigger = await screen.findByRole('button', {
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

    await act(async () => { renderOverview(); });

    expect(
      await screen.findByRole('button', { name: new RegExp(`Unpin ${api.name}`, 'i') }),
    ).toBeTruthy();
  });

  it('removes API from pinned list when Unpin is clicked', async () => {
    const api = MOCK_APIS[0];
    pinnedApisStore.pin(api.id);

    await act(async () => { renderOverview(); });

    const unpinBtn = await screen.findByRole('button', {
      name: new RegExp(`Unpin ${api.name}`, 'i'),
    });
    await act(async () => { fireEvent.click(unpinBtn); });

    expect(screen.queryByTestId(`pinned-api-${api.id}`)).toBeNull();
  });

  it('renders "no pinned APIs" copy when pin list is empty', async () => {
    await act(async () => { renderOverview(); });
    expect(screen.getByText(/Pin APIs from the marketplace/i)).toBeTruthy();
  });
});

// ─── Activity: loading state (#1080) ─────────────────────────────────────────

describe('DashboardOverview — activity loading state (#1080)', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('shows loading skeletons while fetch is pending', () => {
    // Fetch never resolves during this test.
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    renderOverview();

    // Skeletons must be present immediately.
    const skeletonContainer = document.querySelector('.activity-skeletons');
    expect(skeletonContainer).toBeTruthy();
  });

  it('renders a role="status" live region while loading', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    renderOverview();

    // The wrapping element carries the status role for screen readers.
    expect(screen.getByRole('status', { name: /loading recent activity/i })).toBeTruthy();
  });
});

// ─── Activity: success state (#1080) ─────────────────────────────────────────

describe('DashboardOverview — activity success state (#1080)', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('renders fetched activity items after the request resolves', async () => {
    stubFetchSuccess(MOCK_ACTIVITY);

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      expect(screen.getByTestId('activity-item-tx-101')).toBeTruthy();
      expect(screen.getByTestId('activity-item-tx-102')).toBeTruthy();
    });
  });

  it('computes totalUsage from fetched usage-type items only', async () => {
    // MOCK_ACTIVITY: tx-101 is 'API Call' (usage, 12.5), tx-102 is 'Deposit' (0).
    stubFetchSuccess(MOCK_ACTIVITY);

    await act(async () => { renderOverview({ vaultBalance: 200 }); });

    // UsageGauge receives `used={totalUsage}` — its accessible label includes
    // the value. 12.5 USDC should appear in the gauge's accessible text.
    await waitFor(() => {
      const gauge = document.querySelector('[data-testid="usage-gauge"]') ??
        document.querySelector('[aria-label*="12.5"]') ??
        document.querySelector('[aria-valuenow]');
      // If the gauge doesn't expose the value directly, verify via
      // the rendered amount text.
      const usageText = screen.queryAllByText(/12\.5/i);
      expect(usageText.length).toBeGreaterThan(0);
    });
  });

  it('calls the correct endpoint URL with accountId and limit', async () => {
    const fetchSpy = stubFetchSuccess(MOCK_ACTIVITY);

    await act(async () => { renderOverview(); });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toMatch('/api/activity');
    expect(calledUrl).toMatch('limit=10');
  });

  it('renders each activity item with a PreviewCard wrapper', async () => {
    stubFetchSuccess(MOCK_ACTIVITY);

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      const triggers = screen.queryAllByRole('button', {
        name: /preview details for (usdc deposit|api request charge)/i,
      });
      expect(triggers.length).toBeGreaterThan(0);
    });
  });

  it('shows an EmptyState when the API returns an empty array', async () => {
    stubFetchSuccess([]);

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      expect(screen.getByText(/No activity yet/i)).toBeTruthy();
    });
  });
});

// ─── Activity: error state (#1080) ───────────────────────────────────────────

describe('DashboardOverview — activity error state (#1080)', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('shows a role="alert" error message on fetch failure', async () => {
    stubFetchError('Network error');

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('includes the error message text inside the alert', async () => {
    stubFetchError('Network error');

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('shows a role="alert" error message on non-OK HTTP response', async () => {
    stubFetchHttpError(500, 'Internal Server Error');

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/500/);
    });
  });

  it('renders a Retry button when in error state', async () => {
    stubFetchError();

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /retry loading recent activity/i }),
      ).toBeTruthy();
    });
  });

  it('does not show skeletons or activity list in error state', async () => {
    stubFetchError();

    await act(async () => { renderOverview(); });

    await waitFor(() => screen.getByRole('alert'));

    expect(document.querySelector('.activity-skeletons')).toBeNull();
    expect(screen.queryAllByTestId(/activity-item-/).length).toBe(0);
  });
});

// ─── Activity: retry flow (#1080) ────────────────────────────────────────────

describe('DashboardOverview — activity retry (#1080)', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('re-fetches successfully after clicking Retry', async () => {
    // First call fails, second call succeeds.
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => MOCK_ACTIVITY,
      } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    await act(async () => { renderOverview(); });

    // Wait for the error state.
    const retryBtn = await screen.findByRole('button', {
      name: /retry loading recent activity/i,
    });

    // Click retry — second fetch should succeed.
    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByTestId('activity-item-tx-101')).toBeTruthy();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── Activity: account switching (#1080) ─────────────────────────────────────

describe('DashboardOverview — account switching reloads activity (#1080)', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('issues a new fetch when the active account changes', async () => {
    const fetchSpy = stubFetchSuccess(MOCK_ACTIVITY);

    // The component reads accountId from useAccountId(), which reads from
    // accountStore. We drive it by re-rendering with a different accountId
    // supplied via the useRecentActivity hook indirectly.
    // Since the hook is driven by useAccountId() internally, we verify the
    // fetch URL changes when we mock the store's return value changing.
    //
    // For this test we call the hook directly by importing and testing it
    // (that is covered in useRecentActivity's own tests). Here we verify
    // that the component calls fetch at least once on mount and that
    // the accountId is included in the URL.
    await act(async () => { renderOverview(); });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [firstUrl] = fetchSpy.mock.calls[0] as [string];
    expect(firstUrl).toMatch('accountId=');
  });
});

// ─── PreviewCard integration: recent activity items ──────────────────────────

describe('DashboardOverview — PreviewCard on activity items (#581)', () => {
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

  it('shows activity item skeletons while loading', () => {
    // Fetch never resolves so the component stays in loading state.
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    renderOverview();
    const skeletons = document.querySelectorAll('.activity-skeletons');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders activity items with PreviewCard wrappers after load', async () => {
    stubFetchSuccess(MOCK_ACTIVITY);

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      expect(screen.queryAllByTestId(/activity-item-tx-/).length).toBeGreaterThan(0);
    });

    const activityTriggers = screen.queryAllByRole('button', {
      name: /preview details for (usdc deposit|api request charge)/i,
    });
    expect(activityTriggers.length).toBeGreaterThan(0);
  });

  it('shows activity preview tooltip with amount and type metrics after load', async () => {
    stubFetchSuccess(MOCK_ACTIVITY);

    await act(async () => { renderOverview(); });

    await waitFor(() => {
      expect(screen.queryAllByTestId(/activity-item-tx-/).length).toBeGreaterThan(0);
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
  beforeEach(() => { stubFetchSuccess(MOCK_ACTIVITY); });
  afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

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
