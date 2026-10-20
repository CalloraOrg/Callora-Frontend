// @vitest-environment jsdom

/**
 * Global keyboard-shortcut coverage for `App`.
 *
 * `App.handleGlobalKeyDown` registers `once` listeners for the `g`-prefixed
 * navigation sequences (`g h`, `g m`, `g b`, and the undocumented `g a`) and
 * opens `ShortcutsModal` on `?`. `useGlobalShortcuts` suppresses all of this
 * while a form field has focus. None of that was covered by a test.
 *
 * The heavy lazy pages are stubbed: this suite asserts *routing* behaviour, so
 * a page-level render failure should not be able to mask a shortcut
 * regression. `LocationProbe` exposes the router path for assertions.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
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

/** Exposes the active router path so navigation can be asserted directly. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="router-path">{location.pathname}</div>;
}

function renderApp(initialPath = "/") {
  return render(
    <ThemeProvider>
      <CollectionsProvider>
        <AccountProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <LocationProbe />
            {/* Focusable control used by the form-field isolation tests. */}
            <input data-testid="probe-input" aria-label="Probe input" />
            <App />
          </MemoryRouter>
        </AccountProvider>
      </CollectionsProvider>
    </ThemeProvider>,
  );
}

/** `useGlobalShortcuts` listens on `window`, so dispatch there. */
function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(window, { key, ...init });
}

/** Fire a two-key shortcut sequence in order. */
function pressSequence(...keys: string[]) {
  for (const key of keys) {
    press(key);
  }
}

function currentPath(): string | null {
  return screen.getByTestId("router-path").textContent;
}

describe("App global keyboard shortcuts", () => {
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
  });

  it("starts on the requested route", () => {
    renderApp("/");
    expect(currentPath()).toBe("/");
  });

  it("navigates to the dashboard on 'g' then 'h'", async () => {
    renderApp("/");
    pressSequence("g", "h");
    await waitFor(() => expect(currentPath()).toBe("/dashboard"));
  });

  it("navigates to the marketplace on 'g' then 'm'", async () => {
    renderApp("/");
    pressSequence("g", "m");
    await waitFor(() => expect(currentPath()).toBe("/marketplace"));
  });

  it("navigates to billing on 'g' then 'b'", async () => {
    renderApp("/");
    pressSequence("g", "b");
    await waitFor(() => expect(currentPath()).toBe("/billing"));
  });

  it("navigates to My APIs on the undocumented 'g' then 'a' sequence", async () => {
    renderApp("/");
    pressSequence("g", "a");
    await waitFor(() => expect(currentPath()).toBe("/apis/my-apis"));
  });

  it("re-arms the sequence after each shortcut is consumed", async () => {
    renderApp("/");
    pressSequence("g", "m");
    await waitFor(() => expect(currentPath()).toBe("/marketplace"));

    pressSequence("g", "h");
    await waitFor(() => expect(currentPath()).toBe("/dashboard"));
  });

  it("opens the shortcuts dialog on '?'", async () => {
    renderApp("/");
    press("?");

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /shortcuts/i })).toBeTruthy(),
    );
    // The dialog documents the sequences this suite exercises.
    expect(screen.getByText("Go to Marketplace")).toBeTruthy();
  });

  it("does not navigate on 'g' alone", async () => {
    renderApp("/");
    press("g");
    expect(currentPath()).toBe("/");
  });

  it("does not navigate when 'g' is typed into an input", async () => {
    renderApp("/");
    const input = screen.getByTestId("probe-input");
    input.focus();
    expect(document.activeElement).toBe(input);

    pressSequence("g", "h");
    expect(currentPath()).toBe("/");
  });

  it("leaves the route unchanged for an unrecognised sequence", async () => {
    renderApp("/");
    pressSequence("g", "x");
    expect(currentPath()).toBe("/");
  });
});
