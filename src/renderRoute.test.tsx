// @vitest-environment jsdom

/**
 * renderRoute.test.tsx
 *
 * Integration routing tests for renderRoute and SLA deep links.
 * Tests Scenarios 6, 7, and 8:
 *  6. renderRoute("/marketplace/x/sla") renders App, not MarketplacePage
 *  7. renderRoute("/marketplace") and renderRoute("/marketplace?q=...") render MarketplacePage
 *  8. ApiDetailPage contains a link to /marketplace/:id/sla
 */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { renderRoute, type RouteRenderTarget } from "./renderRoute";
import ApiDetailPage from "./pages/ApiDetailPage";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";
import { AccountProvider } from "./hooks/useAccountContext";
import { ToastProvider } from "./components/Toast";

describe("renderRoute — routing dispatcher and deep-link exclusions", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
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
    vi.restoreAllMocks();
  });

  it("Scenario 6: renderRoute('/marketplace/x/sla') falls through to render App, not MarketplacePage", async () => {
    const renderedNodes: React.ReactNode[] = [];
    const root: RouteRenderTarget = {
      render: vi.fn((node) => {
        renderedNodes.push(node);
      }),
    };

    await renderRoute(root, "/marketplace/x/sla");

    expect(root.render).toHaveBeenCalled();
    // Verify that the rendered tree contains App and not StandaloneShell / MarketplacePage
    const finalNode = renderedNodes[renderedNodes.length - 1] as React.ReactElement;

    // Stringify or inspect the rendered element type tree
    const elementString = JSON.stringify(finalNode, (key, value) => {
      if (typeof value === "function") return value.name;
      return value;
    });

    expect(elementString).toContain("App");
    expect(elementString).not.toContain("MarketplacePage");
  });

  it("Scenario 7: renderRoute('/marketplace') renders the standalone MarketplacePage", async () => {
    const renderedNodes: React.ReactNode[] = [];
    const root: RouteRenderTarget = {
      render: vi.fn((node) => {
        renderedNodes.push(node);
      }),
    };

    await renderRoute(root, "/marketplace");

    expect(root.render).toHaveBeenCalled();
    const elementString = JSON.stringify(renderedNodes, (key, value) => {
      if (typeof value === "function") return value.name;
      return value;
    });

    expect(elementString).toContain("MarketplacePage");
  });

  it("Scenario 7 (query branch): renderRoute('/marketplace?q=weather') still renders standalone MarketplacePage", async () => {
    const renderedNodes: React.ReactNode[] = [];
    const root: RouteRenderTarget = {
      render: vi.fn((node) => {
        renderedNodes.push(node);
      }),
    };

    await renderRoute(root, "/marketplace?q=weather");

    expect(root.render).toHaveBeenCalled();
    const elementString = JSON.stringify(renderedNodes, (key, value) => {
      if (typeof value === "function") return value.name;
      return value;
    });

    expect(elementString).toContain("MarketplacePage");
  });

  it("Scenario 8: ApiDetailPage contains a link to /marketplace/:id/sla", async () => {
    render(
      <ThemeProvider>
        <CollectionsProvider>
          <AccountProvider>
            <MemoryRouter initialEntries={["/details/geocode-01"]}>
              <ToastProvider>
                <Routes>
                  <Route path="/details/:id" element={<ApiDetailPage />} />
                </Routes>
              </ToastProvider>
            </MemoryRouter>
          </AccountProvider>
        </CollectionsProvider>
      </ThemeProvider>,
    );

    await waitFor(() => {
      const slaLinks = screen.getAllByRole("link", { name: /SLA/i });
      expect(slaLinks.length).toBeGreaterThan(0);

      const hasCorrectHref = slaLinks.some(
        (link) => link.getAttribute("href") === "/marketplace/geocode-01/sla",
      );
      expect(hasCorrectHref).toBe(true);
    }, { timeout: 3000 });
  });
});
