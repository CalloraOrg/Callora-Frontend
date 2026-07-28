// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardOverview from './DashboardOverview';

function renderOverview(props = {}) {
  return render(
    <MemoryRouter>
      <DashboardOverview {...props} />
    </MemoryRouter>,
  );
}

describe('DashboardOverview Page Component (#689 / b#012)', () => {
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
});
