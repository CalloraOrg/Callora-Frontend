// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import App, { prefetchRoute } from './App';
import { AccountProvider } from './hooks/useAccountContext';
import { ThemeProvider } from './ThemeContext';
import { CollectionsProvider } from './state/collectionsStore';
import { ToastProvider } from './components/Toast';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

function renderApp(initialPath = '/') {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            {/* Mirrors src/main.tsx: ToastProvider wraps every route render path. */}
            <ToastProvider>
              <App />
            </ToastProvider>
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>
  );
}

function renderAppWithRouter(initialEntries: string[], initialIndex: number) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <ThemeProvider>
            <CollectionsProvider>
              <AccountProvider>
                <App />
              </AccountProvider>
            </CollectionsProvider>
          </ThemeProvider>
        ),
      },
    ],
    { initialEntries, initialIndex },
  );

  render(<RouterProvider router={router} />);

  return router;
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

  it('renders /marketplace inside the App shell on a direct deep link', async () => {
    renderApp('/marketplace');

    expect(screen.getByLabelText('Marketplace loading shell')).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /API Marketplace/i })).toBeTruthy();
    }, { timeout: 4000 });

    const primaryNav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(primaryNav).getByRole('link', { name: 'Marketplace' })).toBeTruthy();
  });

  it('renders /details/:id inside the App shell using the detail skeleton while loading', async () => {
    window.history.pushState({}, '', '/details/weather-001');
    renderApp('/details/weather-001');

    expect(screen.getByLabelText('API detail loading shell')).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'WeatherSim API' })).toBeTruthy();
    }, { timeout: 4000 });

    const primaryNav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(primaryNav).getByRole('link', { name: 'Marketplace' })).toBeTruthy();

    window.history.pushState({}, '', '/');
  });

  it('renders /latency-chart inside the App shell on a direct deep link', async () => {
    renderApp('/latency-chart');

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 1, name: 'Latency' })).toBeTruthy();

    const primaryNav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(primaryNav).getByRole('link', { name: 'Dashboard' })).toBeTruthy();
  });

  it('returns from an API detail to the marketplace on history back without remounting the shell', async () => {
    window.history.pushState({}, '', '/details/weather-001');
    const router = renderAppWithRouter(['/marketplace', '/details/weather-001'], 1);

    expect(screen.getByLabelText('API detail loading shell')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'WeatherSim API' })).toBeTruthy();
    }, { timeout: 4000 });

    const topbarBeforeBack = screen.getByRole('banner');

    await router.navigate(-1);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /API Marketplace/i })).toBeTruthy();
    }, { timeout: 4000 });

    expect(screen.getByRole('banner')).toBe(topbarBeforeBack);
    expect(router.state.location.pathname).toBe('/marketplace');

    window.history.pushState({}, '', '/');
  });

  it('boots the app from a single provider-wrapped tree instead of a manual pathname router', () => {
    const main = read('src/main.tsx');

    expect(main).not.toMatch(/renderRoute/);
    expect(main).not.toMatch(/popstate/);
    expect(main).toMatch(/<App \/>/);
    expect(main).toMatch(/<ThemeProvider>[\s\S]*<CollectionsProvider>[\s\S]*<AccountProvider>/);
  });
});
