// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";
import { ToastProvider } from "./components/Toast";

let themePlaygroundShouldThrow = false;

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: vi.fn().mockResolvedValue({ isAllowed: false }),
  getAddress: vi.fn().mockResolvedValue({ address: "" }),
  getNetwork: vi.fn().mockResolvedValue({ network: "TESTNET", networkPassphrase: "" }),
  getNetworkDetails: vi.fn().mockResolvedValue({ network: "TESTNET", networkPassphrase: "" }),
  requestAccess: vi.fn().mockResolvedValue({ address: "" }),
  signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "" }),
  WatchWalletChanges: class {
    watch() {
      return { stop: () => {} };
    }
    stop() {}
  },
}));

vi.mock("./pages/ThemePlayground", () => ({
  default: function MockThemePlayground() {
    if (themePlaygroundShouldThrow) {
      throw new Error("ThemePlayground crashed");
    }
    return <h1>Theme Playground Recovered</h1>;
  },
}));

vi.mock("./pages/PlanBadge", () => {
  throw new Error("ChunkLoadError: Loading chunk PlanBadge failed.");
});

function renderApp(initialPath = "/") {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>,
  );
}

describe("App-level RouteErrorBoundary", () => {
  beforeEach(() => {
    themePlaygroundShouldThrow = false;
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
  });

  it("shows fallback when a routed page throws, keeps topbar usable, and resets on navigation", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    themePlaygroundShouldThrow = true;

    try {
      renderApp("/theme-playground");

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeTruthy();
      });

      // Topbar and primary navigation remain outside the boundary and usable
      const primaryNav = screen.getByRole("navigation", { name: "Primary navigation" });
      const billingLink = within(primaryNav).getByRole("link", { name: "Billing" });
      expect(billingLink).toBeTruthy();

      // Clicking a nav link resets the boundary automatically without manual retry
      fireEvent.click(billingLink);

      await waitFor(() => {
        expect(screen.queryByText("Something went wrong")).toBeNull();
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("recovers when retry succeeds on the second attempt", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    themePlaygroundShouldThrow = true;

    try {
      renderApp("/theme-playground");

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeTruthy();
      });

      themePlaygroundShouldThrow = false;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Theme Playground Recovered" })).toBeTruthy();
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("shows exhausted message and Go home after retry limit, and removes Try again", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    themePlaygroundShouldThrow = true;

    try {
      renderApp("/theme-playground");

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeTruthy();
      });

      // Default maxRetries is 3
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

  it("catches lazy-chunk load failures during Suspense resolution and offers Reload", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      renderApp("/apis/plan-badge");

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeTruthy();
      });

      expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go home" })).toBeTruthy();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
