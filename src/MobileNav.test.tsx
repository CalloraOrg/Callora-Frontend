// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App, { MOBILE_NAV_QUERY } from "./App";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { AccountProvider } from "./hooks/useAccountContext";
import { CollectionsProvider } from "./state/collectionsStore";
import { ThemeProvider } from "./ThemeContext";

const NAV_LINK_LABELS = [
  "Dashboard",
  "Marketplace",
  "My APIs",
  "Billing",
  "Billing History",
  "Theme Playground",
  "Design System",
];

let compactViewport = false;
const mediaListeners = new Set<(event: unknown) => void>();

/**
 * matchMedia stub. MOBILE_NAV_QUERY matches only while `compactViewport` is on;
 * every other query (prefers-color-scheme, prefers-reduced-motion) reports
 * `false`. State is module-level so a hook subscribed through an earlier install
 * still sees a viewport change.
 */
function setViewport(compact: boolean) {
  compactViewport = compact;
  [...mediaListeners].forEach((cb) => cb({ matches: compact }));
}

beforeEach(() => {
  compactViewport = false;
  mediaListeners.clear();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return query === MOBILE_NAV_QUERY ? compactViewport : false;
      },
      media: query,
      onchange: null,
      addListener: (cb: (event: unknown) => void) => mediaListeners.add(cb),
      removeListener: (cb: (event: unknown) => void) => mediaListeners.delete(cb),
      addEventListener: (_type: string, cb: (event: unknown) => void) => mediaListeners.add(cb),
      removeEventListener: (_type: string, cb: (event: unknown) => void) => mediaListeners.delete(cb),
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  cleanup();
});

function renderApp(initialPath = "/") {
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

function getMenuButton() {
  return screen.getByRole("button", { name: /menu/i });
}

function openPanel() {
  fireEvent.click(getMenuButton());
  return screen.getByRole("navigation", { name: "Primary navigation" });
}

describe("Topbar navigation collapse (issue #1067)", () => {
  // ── AC: below the breakpoint only a menu button replaces the links ───────
  it("shows a menu button instead of the inline links on compact viewports", () => {
    setViewport(true);
    renderApp("/");

    const button = getMenuButton();
    expect(button.className).toContain("nav-menu-button");
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes aria-expanded and aria-controls wired to the panel", () => {
    setViewport(true);
    renderApp("/");

    const button = getMenuButton();
    expect(button.getAttribute("aria-expanded")).toBe("false");

    const controls = button.getAttribute("aria-controls");
    expect(controls).toBeTruthy();

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(controls!);
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.contains(button)).toBe(false);
  });

  it("renders every primary link inside the opened panel", () => {
    setViewport(true);
    renderApp("/");
    const nav = openPanel();

    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(NAV_LINK_LABELS);
  });

  it("keeps every link target identical to the desktop nav", () => {
    renderApp("/");
    const desktopHrefs = within(screen.getByRole("navigation", { name: "Primary navigation" }))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    cleanup();
    setViewport(true);
    renderApp("/");
    const panelHrefs = within(openPanel())
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(panelHrefs).toEqual(desktopHrefs);
  });

  // ── AC: focus is moved and trapped inside the panel ──────────────────────
  it("moves focus into the panel and traps Tab inside it", () => {
    setViewport(true);
    renderApp("/");
    const nav = openPanel();
    const links = within(nav).getAllByRole("link");

    expect(document.activeElement).toBe(links[0]);

    links[links.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(links[0]);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(links[links.length - 1]);
  });

  it("marks the active route inside the panel", () => {
    setViewport(true);
    renderApp("/marketplace");
    const nav = openPanel();

    expect(within(nav).getByRole("link", { name: "Marketplace" }).className).toContain("active");
  });

  // ── AC: Escape closes the panel ─────────────────────────────────────────
  it("closes on Escape and returns focus to the menu button", () => {
    setViewport(true);
    renderApp("/");
    const button = getMenuButton();
    openPanel();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes on backdrop click and returns focus to the menu button", () => {
    setViewport(true);
    renderApp("/");
    const button = getMenuButton();
    openPanel();

    fireEvent.click(screen.getByTestId("mobile-nav-backdrop"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("toggles closed when the menu button is pressed again", () => {
    setViewport(true);
    renderApp("/");
    const button = getMenuButton();

    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  // ── AC: navigating closes the panel and restores focus ──────────────────
  it("closes after a panel link navigation and returns focus to the menu button", async () => {
    setViewport(true);
    renderApp("/");
    const button = getMenuButton();
    const nav = openPanel();

    fireEvent.click(within(nav).getByRole("link", { name: "Marketplace" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
    await waitFor(() => {
      expect(document.title).toContain("Marketplace");
    });
  });

  it("closes when navigation happens without a panel link click", async () => {
    setViewport(true);
    renderApp("/");
    const button = getMenuButton();
    openPanel();

    // Global shortcut "g" then "m" navigates programmatically.
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "m" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("swaps back to the inline nav when the viewport grows past the breakpoint", () => {
    setViewport(true);
    renderApp("/");
    const nav = openPanel();
    expect(nav).toBeTruthy();

    act(() => setViewport(false));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
  });

  // ── AC: desktop layout unchanged ─────────────────────────────────────────
  it("renders the inline nav links on desktop with no menu button", () => {
    setViewport(false);
    renderApp("/");

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(nav.className).toBe("nav");
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(NAV_LINK_LABELS);
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps prefetch-on-hover and prefetch-on-focus working on panel links", async () => {
    setViewport(true);
    renderApp("/");
    const nav = openPanel();

    // The collapsed panel renders the same PrimaryNavLinks component as the
    // desktop bar, so hover/focus must still be safe prefetch triggers.
    const links = within(nav).getAllByRole("link");
    for (const link of links) {
      expect(() => {
        fireEvent.mouseEnter(link);
        link.focus();
      }).not.toThrow();
    }

    await act(async () => {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    });

    // Prefetching must not dismiss the panel or move focus out of it.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(links[links.length - 1]);
  });
});

describe("index.css collapse contract", () => {
  const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

  it("declares a media query matching the JS breakpoint", () => {
    const width = MOBILE_NAV_QUERY.match(/\d+/)?.[0];
    expect(width).toBeTruthy();
    expect(css).toContain(`@media (max-width: ${width}px)`);
  });

  it("styles the menu button, backdrop and panel", () => {
    expect(css).toMatch(/\.nav-menu-button\s*\{/);
    expect(css).toMatch(/\.mobile-nav-backdrop\s*\{/);
    expect(css).toMatch(/\.mobile-nav-panel\s*\{/);
  });

  it("gives panel links a 44px touch target", () => {
    expect(css).toMatch(/\.mobile-nav-panel \.nav a\s*\{[^}]*min-height:\s*44px/);
  });
});

describe("useMediaQuery", () => {
  function Probe() {
    const compact = useMediaQuery(MOBILE_NAV_QUERY);
    return <p>{compact ? "compact" : "wide"}</p>;
  }

  it("re-renders when the query result changes", () => {
    setViewport(false);
    render(<Probe />);
    expect(screen.getByText("wide")).toBeTruthy();

    act(() => setViewport(true));
    expect(screen.getByText("compact")).toBeTruthy();

    act(() => setViewport(false));
    expect(screen.getByText("wide")).toBeTruthy();
  });

  it("falls back to false when matchMedia is unavailable", () => {
    const original = window.matchMedia;
    // @ts-expect-error deliberately removing the browser API
    delete window.matchMedia;

    try {
      render(<Probe />);
      expect(screen.getByText("wide")).toBeTruthy();
    } finally {
      Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: original });
    }
  });
});
