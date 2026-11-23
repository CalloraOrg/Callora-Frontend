// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AccountProvider } from "./hooks/useAccountContext";
import { ThemeProvider } from "./ThemeContext";
import { CollectionsProvider } from "./state/collectionsStore";
import { ToastProvider } from "./components/Toast";

vi.mock("./pages/MarketplacePage", () => ({
  default: () => <div data-testid="stub-page" />,
}));
vi.mock("./pages/MyApis", () => ({
  default: () => <div data-testid="stub-page" />,
}));
vi.mock("./pages/DashboardPage", () => ({
  default: () => <div data-testid="stub-page" />,
}));

function renderApp() {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <ToastProvider>
          <AccountProvider>
            <MemoryRouter initialEntries={["/"]}>
              <App />
            </MemoryRouter>
          </AccountProvider>
        </ToastProvider>
      </CollectionsProvider>
    </ThemeProvider>,
  );
}

describe("App offline banner (Issue #1403)", () => {
  const originalOnLine = navigator.onLine;

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value,
    });
  }

  afterEach(() => {
    setOnline(originalOnLine);
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the banner offline and announces the recovery", async () => {
    setOnline(false);
    renderApp();

    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("live-region-connectivity")).toHaveTextContent(
        "You are back online. Refreshing data.",
      );
    });
  });
});
