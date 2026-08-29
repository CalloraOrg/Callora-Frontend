// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App, { prefetchRoute } from './App';
import { AccountProvider } from './hooks/useAccountContext';
import { ThemeProvider } from './ThemeContext';
import { CollectionsProvider } from './state/collectionsStore';

function renderApp(initialPath = '/') {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <App />
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>
  );
}

describe('Route Splitting and Responsiveness Suite (Quality-2)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the landing route synchronously without route loading fallback delay', async () => {
    renderApp('/');
    expect(screen.getByText(/Secure USDC funding for premium API usage/i)).toBeTruthy();
    const primaryNav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(primaryNav).getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(within(primaryNav).getByRole('link', { name: 'Marketplace' })).toBeTruthy();
  });

  it('dynamically loads Plan Badge route inside Suspense boundary', async () => {
    renderApp('/apis/plan-badge');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Plan Badge/i })).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('dynamically loads Webhook Deliveries route inside Suspense boundary', async () => {
    renderApp('/webhooks/deliveries');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Webhook Deliveries/i })).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('dynamically loads Rate Limit Card route inside Suspense boundary', async () => {
    renderApp('/rate-limit');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Rate Limit Configuration/i })).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('dynamically loads Theme Playground route inside Suspense boundary', async () => {
    renderApp('/theme-playground');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Theme Playground/i })).toBeTruthy();
    }, { timeout: 4000 });
  });

  it('triggers prefetch on link hover/focus without crashing or throwing errors', async () => {
    renderApp('/');
    const primaryNav = screen.getByRole('navigation', { name: 'Primary navigation' });
    const marketplaceLink = within(primaryNav).getByRole('link', { name: 'Marketplace' });
    const dashboardLink = within(primaryNav).getByRole('link', { name: 'Dashboard' });

    fireEvent.mouseEnter(marketplaceLink);
    fireEvent.focus(marketplaceLink);
    fireEvent.mouseEnter(dashboardLink);
    fireEvent.focus(dashboardLink);

    expect(() => prefetchRoute('/marketplace')).not.toThrow();
    expect(() => prefetchRoute('/non-existent-route')).not.toThrow();
  });

  it('handles rapid route transitions via navigation without race conditions or error state', async () => {
    renderApp('/');
    const primaryNav = screen.getByRole('navigation', { name: 'Primary navigation' });

    const themeLink = within(primaryNav).getByRole('link', { name: 'Theme Playground' });
    fireEvent.click(themeLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Theme Playground/i })).toBeTruthy();
    });

    const designSystemLink = within(primaryNav).getByRole('link', { name: 'Design System' });
    fireEvent.click(designSystemLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Design System/i })).toBeTruthy();
    });
  });
});
