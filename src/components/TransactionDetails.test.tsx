// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionDetails } from './TransactionDetails';
import type { PreviewCardData } from './PreviewCard';

const HASH = 'A3F9B2C1D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1';
const data: PreviewCardData = {
  id: 'tx-1',
  title: 'USDC vault deposit',
  txHash: HASH,
  network: 'Stellar Mainnet',
  confirmations: 120,
  timestamp: '2026-07-25T14:32:00Z',
};

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

describe('TransactionDetails', () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('shows the network, confirmations, full hash and a formatted time', () => {
    stubClipboard();
    render(<TransactionDetails data={data} />);
    expect(screen.getByText('Stellar Mainnet')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText(HASH)).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it('copies the full hash and confirms it', async () => {
    const writeText = stubClipboard();
    render(<TransactionDetails data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy transaction hash' }));
    expect(await screen.findByText('Copied!')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(HASH);
  });

  it('omits rows it has no data for', () => {
    stubClipboard();
    render(<TransactionDetails data={{ id: 'tx-2', title: 'Bare' }} />);
    expect(screen.queryByText('Network')).toBeNull();
    expect(screen.queryByText('Confirmations')).toBeNull();
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });
});
