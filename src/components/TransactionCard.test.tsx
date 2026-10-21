// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionCard } from './TransactionCard';
import type { BillingTransaction } from '../pages/BillingHistory';

const tx: BillingTransaction = {
  id: 'tx-1',
  description: 'USDC vault deposit',
  type: 'Deposit',
  direction: 'credit',
  amount: 100,
  status: 'success',
  timestamp: '2026-07-25T14:32:00Z',
  txHash: 'A'.repeat(64),
  network: 'Stellar Mainnet',
  confirmations: 120,
};

function renderCard(overrides: Partial<BillingTransaction> = {}, onDetails = vi.fn()) {
  const item = { ...tx, ...overrides };
  render(
    <ul>
      <TransactionCard tx={item} dateText="Jul 25, 02:32 PM" statusLabel="Confirmed" onDetails={onDetails} />
    </ul>,
  );
  return { item, onDetails };
}

describe('TransactionCard', () => {
  afterEach(cleanup);

  it('is a list item with the description as its heading', () => {
    renderCard();
    expect(screen.getByRole('listitem')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'USDC vault deposit' })).toBeTruthy();
  });

  it('shows a plus sign for credits and a minus sign for debits', () => {
    renderCard();
    expect(screen.getByText(/^\+.*USDC$/)).toBeTruthy();
    cleanup();
    renderCard({ direction: 'debit' });
    expect(screen.getByText(/^\u2212.*USDC$/)).toBeTruthy();
  });

  it('shows the date and a text status label (not colour alone)', () => {
    renderCard();
    expect(screen.getByText('Jul 25, 02:32 PM')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
  });

  it('calls onDetails with the transaction and the tapped button', () => {
    const { item, onDetails } = renderCard();
    const button = screen.getByRole('button', { name: /^details/i });
    fireEvent.click(button);
    expect(onDetails).toHaveBeenCalledWith(item, button);
  });

  it('labels the Details button with the date so identical descriptions stay distinguishable', () => {
    renderCard();
    expect(
      screen.getByRole('button', { name: 'Details for USDC vault deposit, Jul 25, 02:32 PM' }),
    ).toBeTruthy();
  });
});
