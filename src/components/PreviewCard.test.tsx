// @vitest-environment jsdom
/**
 * PreviewCard.test.tsx
 *
 * Tests for the PreviewCard component covering:
 *   - Dashboard/generic usage (original issue #689 surface)
 *   - Billing-specific mode (GrantFox FWC26 — txHash, network,
 *     confirmations, type, amount, direction, timestamp fields)
 *   - Keyboard accessibility (focus open, Escape close, aria-describedby)
 *   - ARIA semantics (role="tooltip", aria-label)
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PreviewCard, { type PreviewCardData } from './PreviewCard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DASHBOARD_DATA: PreviewCardData = {
  id: 'test-api-preview',
  title: 'WeatherSim API',
  subtitle: 'Callora Verified',
  category: 'Weather & Climate',
  description: 'Global high-resolution weather forecasting API endpoint.',
  status: 'operational',
  price: 0.005,
  tags: ['weather', 'forecast', 'climate'],
  metrics: [
    { label: 'Latency', value: '35ms' },
    { label: 'Uptime', value: '99.9%' },
  ],
  lastActive: '10 mins ago',
};

/** Billing-mode data: includes at least one FWC26-specific field. */
const BILLING_DATA: PreviewCardData = {
  id: 'tx-001',
  title: 'USDC vault deposit',
  status: 'success',
  type: 'Deposit',
  direction: 'credit',
  amount: 100.0,
  txHash: 'A3F9B2C1D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1',
  network: 'Stellar Mainnet',
  confirmations: 120,
  timestamp: '2026-07-25T14:32:00Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWrapper(container: HTMLElement) {
  return container.querySelector('.preview-card__wrapper') as HTMLElement;
}

function getTrigger() {
  return screen.getByRole('button', { name: /preview details for/i });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PreviewCard — shared behaviour', () => {
  afterEach(cleanup);

  it('does not render the preview panel initially', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders a trigger with an accessible aria-label', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    expect(
      screen.getByRole('button', { name: /preview details for weathersim api/i }),
    ).toBeTruthy();
  });

  it('opens panel on mouseEnter and closes on mouseLeave', () => {
    const { container } = render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    const wrapper = getWrapper(container);

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens panel when trigger receives keyboard focus', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('sets aria-describedby on trigger while panel is open', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    const trigger = getTrigger();
    fireEvent.focus(trigger);

    const panel = screen.getByRole('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(panel.id);
  });

  it('clears aria-describedby when panel is closed', () => {
    const { container } = render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    const wrapper = getWrapper(container);
    const trigger = getTrigger();

    fireEvent.mouseEnter(wrapper);
    expect(trigger.getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.mouseLeave(wrapper);
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('closes panel on Escape and removes aria-describedby', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    const trigger = getTrigger();
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('panel has role="tooltip" and an aria-label', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel.getAttribute('aria-label')).toBeTruthy();
  });

  it('panel has pointer-events: none to avoid mouse trapping', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel.style.pointerEvents).toBe('none');
  });

  it('passes custom position prop without crashing', () => {
    const { container } = render(
      <PreviewCard data={DASHBOARD_DATA} position="top">
        <div>trigger</div>
      </PreviewCard>,
    );
    const wrapper = getWrapper(container);
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('passes className to wrapper', () => {
    const { container } = render(
      <PreviewCard data={DASHBOARD_DATA} className="custom-class">
        <div>trigger</div>
      </PreviewCard>,
    );
    const wrapper = getWrapper(container);
    expect(wrapper.classList.contains('custom-class')).toBe(true);
  });
});

// ── Dashboard-mode tests ──────────────────────────────────────────────────────

describe('PreviewCard — dashboard mode (no billing fields)', () => {
  afterEach(cleanup);

  it('renders title, status badge, description, metrics, and tags', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('WeatherSim API');
    expect(panel).toHaveTextContent('Global high-resolution weather forecasting API endpoint.');
    expect(panel).toHaveTextContent('Latency');
    expect(panel).toHaveTextContent('35ms');
    expect(panel).toHaveTextContent('#weather');
    expect(panel).toHaveTextContent('$0.005 / call');
    expect(panel).toHaveTextContent('Last active: 10 mins ago');
  });

  it('does not render the billing section when no billing fields are provided', () => {
    render(
      <PreviewCard data={DASHBOARD_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    // The billing section shows "Network", "Confirmations", "Tx hash"
    const panel = screen.getByRole('tooltip');
    expect(panel).not.toHaveTextContent('Network');
    expect(panel).not.toHaveTextContent('Confirmations');
    expect(panel).not.toHaveTextContent('Tx hash');
  });
});

// ── Billing-mode tests (FWC26) ────────────────────────────────────────────────

describe('PreviewCard — billing mode (FWC26)', () => {
  afterEach(cleanup);

  it('renders billing section when txHash is provided', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('Tx hash');
    // truncated hash: first 8 chars
    expect(panel).toHaveTextContent('A3F9B2C1');
  });

  it('renders transaction type and credit direction badge', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('Type');
    expect(panel).toHaveTextContent('Deposit');
    expect(panel).toHaveTextContent('credit');
  });

  it('renders debit direction badge when direction is debit', () => {
    const debitData: PreviewCardData = {
      ...BILLING_DATA,
      direction: 'debit',
      title: 'API Call',
    };
    render(
      <PreviewCard data={debitData}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    expect(screen.getByRole('tooltip')).toHaveTextContent('debit');
  });

  it('renders formatted amount with USDC label', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('Amount');
    expect(panel).toHaveTextContent('100.00 USDC');
  });

  it('renders network name', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    expect(screen.getByRole('tooltip')).toHaveTextContent('Stellar Mainnet');
  });

  it('renders confirmation count', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('Confirmations');
    expect(panel).toHaveTextContent('120');
  });

  it('renders timestamp as a <time> element with dateTime attribute', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    const timeEl = panel.querySelector('time');
    expect(timeEl).toBeTruthy();
    expect(timeEl!.getAttribute('dateTime')).toBe('2026-07-25T14:32:00Z');
  });

  it('does not render generic metrics grid in billing mode', () => {
    const billingWithMetrics: PreviewCardData = {
      ...BILLING_DATA,
      metrics: [{ label: 'ShouldNotAppear', value: 'X' }],
    };
    render(
      <PreviewCard data={billingWithMetrics}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    // Metrics grid is suppressed in billing mode
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('ShouldNotAppear');
  });

  it('does not render generic price/lastActive footer in billing mode', () => {
    const billingWithPrice: PreviewCardData = {
      ...BILLING_DATA,
      price: 999,
      lastActive: 'yesterday',
    };
    render(
      <PreviewCard data={billingWithPrice}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel).not.toHaveTextContent('$999 / call');
    expect(panel).not.toHaveTextContent('Last active: yesterday');
  });

  it('renders escape-key hint inside the panel', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    expect(screen.getByRole('tooltip')).toHaveTextContent('Esc');
  });

  it('keyboard: Escape closes billing preview and clears aria-describedby', () => {
    render(
      <PreviewCard data={BILLING_DATA}>
        <div>trigger</div>
      </PreviewCard>,
    );
    const trigger = getTrigger();
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('detects billing mode from amount alone (no txHash)', () => {
    const amountOnly: PreviewCardData = {
      id: 'tx-x',
      title: 'Partial billing data',
      amount: 25.5,
      direction: 'credit',
    };
    render(
      <PreviewCard data={amountOnly}>
        <div>trigger</div>
      </PreviewCard>,
    );
    fireEvent.focus(getTrigger());

    const panel = screen.getByRole('tooltip');
    expect(panel).toHaveTextContent('Amount');
    expect(panel).toHaveTextContent('25.50 USDC');
  });
});
