// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";

vi.mock("./pages/MarketplacePage", () => ({
  default: () => <div data-testid="stub-page" />,
}));
vi.mock("./pages/MyApis", () => ({
  default: () => <div data-testid="stub-page" />,
}));
vi.mock("./pages/DashboardPage", () => ({
  default: () => <div data-testid="stub-page" />,
}));
vi.mock("./pages/WebhookDeliveries", () => ({
  default: () => <div data-testid="stub-page" />,
}));

function renderApp(initialPath: string) {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <App />
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>,
  );
}

describe("App per-route robots meta", () => {
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
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.remove();
  });

  it("sets noindex robots meta on /billing", () => {
    renderApp("/billing");
    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    expect(robots).toBeTruthy();
    expect(robots?.getAttribute("content")).toBe("noindex, nofollow");
  });

  it("does not set robots meta on public /marketplace route", () => {
    renderApp("/marketplace");
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("removes robots meta when navigating away from /billing to /marketplace", async () => {
    renderApp("/billing");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, nofollow",
    );

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "m" });

    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')).toBeNull();
    });
  });
});
