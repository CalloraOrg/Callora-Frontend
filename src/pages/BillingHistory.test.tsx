// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BillingHistory, { type BillingRecord } from './BillingHistory';

const MOCK_RECORDS: BillingRecord[] = [
  {
    id: 'bill-1',
    type: 'invoice',
    title: 'Monthly API Usage',
    description: 'Aggregated charges for all API calls in February 2026.',
    amount: 4200.0,
    date: '2026-02-28',
    status: 'success',
    invoiceNumber: 'INV-2026-0028',
    category: 'API Usage',
    method: 'Vault',
  },
  {
    id: 'bill-2',
    type: 'payment',
    title: 'USDC Vault Deposit',
    description: 'Deposit from connected Freighter wallet.',
    amount: 500.0,
    date: '2026-02-15',
    status: 'operational',
    method: 'Freighter Wallet',
  },
  {
    id: 'bill-3',
    type: 'charge',
    title: 'WeatherSim API Calls',
    description: 'Per-request charges for WeatherSim /v1/forecast endpoint.',
    amount: 12.5,
    date: '2026-02-27',
    status: 'operational',
    category: 'Weather & Climate',
  },
];

describe('BillingHistory Page Component (#692)', () => {
  afterEach(cleanup);

  it('renders the section heading and subtitle', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    expect(screen.getByText('Billing History')).toBeTruthy();
    expect(
      screen.getByText('Invoices, payments, and usage charges with preview details on hover or focus.'),
    ).toBeTruthy();
  });

  it('renders all billing records as list items', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    expect(screen.getByText('Monthly API Usage')).toBeTruthy();
    expect(screen.getByText('USDC Vault Deposit')).toBeTruthy();
    expect(screen.getByText('WeatherSim API Calls')).toBeTruthy();
  });

  it('renders invoice numbers and dates for records that have them', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    expect(screen.getByText('INV-2026-0028')).toBeTruthy();
    expect(screen.getByText('2026-02-28')).toBeTruthy();
  });

  it('renders formatted amounts with correct sign (credit vs debit)', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    // Invoice (debit): -USDC 4,200.00
    expect(screen.getByText(/-USDC 4,200\.00/)).toBeTruthy();
    // Payment (credit): +USDC 500.00
    expect(screen.getByText(/\+USDC 500\.00/)).toBeTruthy();
  });

  it('shows empty state when records array is empty', () => {
    render(<BillingHistory records={[]} />);

    expect(screen.getByText('No billing records yet.')).toBeTruthy();
  });

  it('wraps each billing item in a PreviewCard trigger', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    const trigger1 = screen.getByRole('button', {
      name: /preview details for monthly api usage/i,
    });
    expect(trigger1).toBeTruthy();

    const trigger2 = screen.getByRole('button', {
      name: /preview details for usdc vault deposit/i,
    });
    expect(trigger2).toBeTruthy();
  });

  it('opens preview panel on focus and shows record details', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    const trigger = screen.getByRole('button', {
      name: /preview details for monthly api usage/i,
    });

    fireEvent.focus(trigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip).toHaveTextContent('Monthly API Usage');
    expect(tooltip).toHaveTextContent('Invoice');
    expect(tooltip).toHaveTextContent('Aggregated charges for all API calls in February 2026.');
  });

  it('opens preview panel on hover and shows correct metrics', () => {
    const { container } = render(<BillingHistory records={MOCK_RECORDS} />);

    const wrapper = container.querySelector('.preview-card__wrapper') as HTMLElement;
    expect(wrapper).toBeTruthy();

    fireEvent.mouseEnter(wrapper);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip).toHaveTextContent('Amount');
    expect(tooltip).toHaveTextContent('Date');
  });

  it('closes preview panel on Escape key', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    const trigger = screen.getByRole('button', {
      name: /preview details for monthly api usage/i,
    });

    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeTruthy();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('links trigger to preview panel via aria-describedby while open', () => {
    render(<BillingHistory records={MOCK_RECORDS} />);

    const trigger = screen.getByRole('button', {
      name: /preview details for monthly api usage/i,
    });

    fireEvent.focus(trigger);

    const panel = screen.getByRole('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(panel.id);
  });

  it('renders refund type as credit with positive sign', () => {
    const refundRecord: BillingRecord = {
      id: 'bill-refund',
      type: 'refund',
      title: 'API Overcharge Refund',
      description: 'Refund issued for duplicate charge on WeatherSim API.',
      amount: 25.0,
      date: '2026-03-01',
      status: 'success',
      invoiceNumber: 'RFND-001',
    };

    render(<BillingHistory records={[refundRecord]} />);

    expect(screen.getByText(/\+USDC 25\.00/)).toBeTruthy();
  });
});
