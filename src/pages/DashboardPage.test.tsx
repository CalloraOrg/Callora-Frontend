// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';

function renderDashboardPage(props = {}) {
  return render(
    <MemoryRouter>
      <DashboardPage {...props} />
    </MemoryRouter>,
  );
}

describe('DashboardPage — document title, meta wiring, and prop forwarding (#1135)', () => {
  const originalTitle = document.title;
  let originalMeta: HTMLMetaElement | null = null;

  beforeEach(() => {
    document.title = 'Initial Title';
    originalMeta = document.querySelector('meta[name="description"]');
    if (originalMeta) {
      originalMeta.setAttribute('content', 'Initial description');
    }
  });

  afterEach(() => {
    cleanup();
    document.title = originalTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (originalMeta) {
      meta?.setAttribute('content', 'Initial description');
    } else {
      meta?.remove();
    }
  });

  it('sets document.title to "Dashboard – Callora"', () => {
    renderDashboardPage();
    expect(document.title).toBe('Dashboard – Callora');
  });

  it('sets the meta description tag with dashboard summary content', () => {
    renderDashboardPage();
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe(
      'Your Callora dashboard showing balances, recent activity and quick actions.',
    );
  });

  it('creates and attaches a meta description tag if none existed, and restores on unmount', () => {
    const existingMeta = document.querySelector('meta[name="description"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    const { unmount } = renderDashboardPage();
    const createdMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    expect(createdMeta).not.toBeNull();
    expect(createdMeta?.getAttribute('content')).toBe(
      'Your Callora dashboard showing balances, recent activity and quick actions.',
    );

    unmount();
    expect(document.title).toBe('Initial Title');
  });

  it('restores previous title and description on unmount', () => {
    const { unmount } = renderDashboardPage();
    expect(document.title).toBe('Dashboard – Callora');

    unmount();
    expect(document.title).toBe('Initial Title');
  });

  it('forwards vaultBalance and walletBalance props to DashboardOverview', () => {
    renderDashboardPage({
      vaultBalance: 250.75,
      walletBalance: 500.5,
    });

    expect(screen.getByText('Vault balance')).toBeTruthy();
    expect(screen.getByText('250.75 USDC')).toBeTruthy();
    expect(screen.getByText('Wallet available')).toBeTruthy();
    expect(screen.getByText('500.50 USDC')).toBeTruthy();
  });

  it('forwards openDeposit prop and invokes it from primary deposit action', () => {
    const handleDeposit = vi.fn();
    renderDashboardPage({
      vaultBalance: 150,
      openDeposit: handleDeposit,
    });

    const depositButton = screen.getByRole('button', { name: /^Deposit$/i });
    expect(depositButton).toBeTruthy();

    fireEvent.click(depositButton);
    expect(handleDeposit).toHaveBeenCalledTimes(1);
  });

  it('forwards openDeposit callback and invokes it with preset top-up amounts', () => {
    const handleDeposit = vi.fn();
    renderDashboardPage({
      vaultBalance: 150,
      openDeposit: handleDeposit,
    });

    const topup50 = screen.getByRole('button', { name: /Quick top-up with 50 USDC/i });
    fireEvent.click(topup50);
    expect(handleDeposit).toHaveBeenCalledWith(50);

    const topup100 = screen.getByRole('button', { name: /Quick top-up with 100 USDC/i });
    fireEvent.click(topup100);
    expect(handleDeposit).toHaveBeenCalledWith(100);
  });

  it('forwards custom className and props to DashboardOverview root container', () => {
    const { container } = renderDashboardPage({
      className: 'custom-dashboard-class',
    });

    const wrapper = container.querySelector('.dashboard-overview-container');
    expect(wrapper?.classList.contains('custom-dashboard-class')).toBe(true);
  });
});
