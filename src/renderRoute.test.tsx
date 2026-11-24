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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { renderRoute, type RouteRenderTarget } from "./renderRoute";
import ApiDetailPage from "./pages/ApiDetailPage";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";
import { AccountProvider } from "./hooks/useAccountContext";
import { ToastProvider } from "./components/Toast";

let publishRenderShouldThrow = false;

vi.mock("./services/authService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./services/authService")>();
  return {
    ...actual,
    isSignedIn: () => true,
    useIsSignedIn: () => true,
  };
});

vi.mock("./pages/PublishApi", () => ({
  default: function MockPublishApi() {
    if (publishRenderShouldThrow) {
      throw new Error("PublishApi exploded");
    }
    return <div>Mock PublishApi Page</div>;
  },
}));

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
    publishRenderShouldThrow = false;
    cleanup();
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

  it("catches a render error in a standalone shell route and renders the fallback inside StandaloneShell", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    publishRenderShouldThrow = true;

    try {
      let renderedTree: React.ReactNode = null;
      const root: RouteRenderTarget = {
        render: vi.fn((node) => {
          renderedTree = node;
        }),
      };

      await renderRoute(root, "/publish");
      expect(renderedTree).not.toBeNull();

      const { container } = render(<>{renderedTree}</>);

      // Fallback is rendered inside the standalone shell while header/nav remain usable
      expect(screen.getByRole("banner")).toBeTruthy();
      expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();
      const standaloneMain = container.querySelector(".standalone-main");
      expect(standaloneMain).not.toBeNull();
      const alert = screen.getByRole("alert");
      expect(standaloneMain?.contains(alert)).toBe(true);
      expect(screen.getByText("Something went wrong")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go home" })).toBeTruthy();

      // Exhaust retries (default maxRetries = 3)
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(screen.getByText("This page couldn't be recovered")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.getByRole("button", { name: "Go home" })).toBeTruthy();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("renders /embed/api/:id chromelessly with ?theme=dark and without persisting theme", async () => {
    window.localStorage.removeItem("callora_pref_theme");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    try {
      let renderedTree: React.ReactNode = null;
      const root: RouteRenderTarget = {
        render: vi.fn((node) => {
          renderedTree = node;
        }),
      };

      await renderRoute(root, "/embed/api/geocode-01?theme=dark");
      expect(renderedTree).not.toBeNull();

      render(<>{renderedTree}</>);

      expect(screen.queryByRole("banner")).toBeNull();
      expect(screen.queryByRole("navigation")).toBeNull();

      await waitFor(() => {
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      });

      const themeWrites = setItemSpy.mock.calls.filter(([key]) =>
        String(key).includes("theme"),
      );
      expect(themeWrites).toHaveLength(0);
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("falls back to system theme when /embed/api/:id has an invalid ?theme= value", async () => {
    let renderedTree: React.ReactNode = null;
    const root: RouteRenderTarget = {
      render: vi.fn((node) => {
        renderedTree = node;
      }),
    };

    await renderRoute(root, "/embed/api/geocode-01?theme=invalid-theme");
    expect(renderedTree).not.toBeNull();

    render(<>{renderedTree}</>);

    // matchMedia mock in beforeEach returns matches: false -> system resolves to "light"
    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });
});
