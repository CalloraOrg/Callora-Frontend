// @vitest-environment jsdom

import { act } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiDetailPage from "./ApiDetailPage";
import { ToastProvider } from "../components/Toast";
import { CollectionsProvider } from "../state/collectionsStore";

// Mock matchMedia (required by the Tabs component)
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

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <CollectionsProvider>
      <ToastProvider>{ui}</ToastProvider>
    </CollectionsProvider>
  );
}

// Mock IntersectionObserver (required by ApiDetailStickyTOC)
const observeMock = vi.fn();
const disconnectMock = vi.fn();
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: observeMock,
    unobserve: vi.fn(),
    disconnect: disconnectMock,
  })),
});

function settleLoadingState() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe("ApiDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/details/weather-001");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  // ── Existing tests ────────────────────────────────────────────────────────

  it("renders endpoint group previews in the documentation tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    expect(screen.getByRole("heading", { name: "Endpoint groups" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /forecast 1 endpoint/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /historical weather 1 endpoint/i })).toBeTruthy();
  });

  it("shows the group preview when a trigger receives keyboard focus", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
    fireEvent.focus(screen.getByRole("button", { name: /forecast 1 endpoint/i }));

    const preview = screen.getByLabelText("Forecast group preview");
    expect(preview).toBeTruthy();
    expect(within(preview).getByText("Get Forecast")).toBeTruthy();
    expect(within(preview).getByText(/1 endpoint.*2 request parameter/)).toBeTruthy();
  });

  // ── Skeleton / loading ────────────────────────────────────────────────────

  it("shows loading skeleton before data resolves", () => {
    renderWithProviders(<ApiDetailPage />);
    // Before timers advance, loading state should be active
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("renders the API name after loading completes", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    // The mock API at weather-001 should have a visible h1
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  // ── Not found / Empty state ───────────────────────────────────────────────

  it("shows the EmptyState when API is not found", () => {
    window.history.pushState({}, "", "/details/non-existent-api");
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    expect(screen.getByRole("heading", { name: "API not found" })).toBeTruthy();
    expect(
      screen.getByText("This API may have moved or is no longer available."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to marketplace" })).toBeTruthy();
    expect(screen.getByTestId("empty-state-api-detail").querySelector("svg")).toBeTruthy();
  });

  // ── Tab switching ─────────────────────────────────────────────────────────

  it("defaults to the overview tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    expect(screen.getByText("About this API")).toBeTruthy();
  });

  it("switches to the pricing tab when the tab is clicked", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));
    expect(screen.getByText("Pricing Plans")).toBeTruthy();
  });

  it("shows plan badges with tooltips on the pricing tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

    const proBadge = screen.getByText("Pro");
    const enterpriseBadge = screen.getByText("Enterprise");
    expect(proBadge).toBeTruthy();
    expect(enterpriseBadge).toBeTruthy();

    fireEvent.focus(enterpriseBadge);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("Enterprise plan");
    expect(tip.textContent).toContain("Custom / unmetered");
  });

  it("switches to the examples tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    fireEvent.click(screen.getByRole("tab", { name: "Examples" }));
    expect(screen.getByText("Integration Gallery")).toBeTruthy();
  });

  it("shows the available page shortcuts next to the tab navigation", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    const hint = screen.getByLabelText("Keyboard shortcuts");
    expect(within(hint).getByText("Esc")).toBeTruthy();
    expect(within(hint).getByText("Go back to Marketplace")).toBeTruthy();
    expect(within(hint).getByText("1-5")).toBeTruthy();
    expect(within(hint).getByText(/Switch tabs/)).toBeTruthy();
  });

  // ── ApiDetailStickyTOC integration ────────────────────────────────────────

  it("renders the TOC nav when the documentation tab is active", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy();
  });

  it("renders all expected TOC anchor links", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(nav.querySelector('a[href="#toc-endpoints"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#toc-parameters"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#toc-implementation"]')).toBeTruthy();
  });

  it("does not render the TOC on the overview tab", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    // Default tab is overview — TOC must be absent
    expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
  });

  it("TOC link labels match the expected section titles", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    const nav = screen.getByRole("navigation", { name: "On this page" });
    const links = Array.from(nav.querySelectorAll("a"));
    const labels = links.map((a) => a.textContent?.trim());

    expect(labels).toContain("Endpoints");
    expect(labels).toContain("Parameters");
    expect(labels).toContain("Implementation");
  });

  it("TOC links point to heading elements that exist in the DOM", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    expect(document.getElementById("toc-endpoints")).toBeTruthy();
    expect(document.getElementById("toc-parameters")).toBeTruthy();
    expect(document.getElementById("toc-implementation")).toBeTruthy();
  });

  it("lets the user save an endpoint into a new collection from the save panel", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();
    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));

    const saveButtons = screen.getAllByRole("button", {
      name: /Save endpoint to collection/i,
    });
    fireEvent.click(saveButtons[0]);

    const dialog = screen.getByRole("dialog", {
      name: /Save endpoint to collection/i,
    });
    expect(within(dialog).getByText(/no collections yet/i)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: /new collection/i }));
    const input = within(dialog).getByRole("textbox", {
      name: /new collection name/i,
    });
    fireEvent.change(input, { target: { value: "Weather collection" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Save/i }));

    const collectionCheckbox = within(dialog).getByRole("checkbox", {
      name: /Remove from collection "Weather collection"/i,
    }) as HTMLInputElement;
    expect(collectionCheckbox.checked).toBe(true);
    expect(screen.getByRole("button", { name: /Saved endpoint/i })).toBeTruthy();
  });

  describe("prefers-reduced-motion", () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it("bypasses loading skeleton delay and resolves immediately when prefers-reduced-motion is active", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)" || query.includes("reduce"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));

      renderWithProviders(<ApiDetailPage />);
      
      // Without advancing timers, loading should resolve immediately since delay is 0ms
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // The mock API weather-001 should be rendered
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    });

    it("sets tab content animation style to 'none' when prefers-reduced-motion is active", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)" || query.includes("reduce"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }));

      renderWithProviders(<ApiDetailPage />);
      
      act(() => {
        vi.advanceTimersByTime(0);
      });

      // Find the tab content container. It has class 'tab-content'
      const tabContent = document.querySelector(".tab-content");
      expect(tabContent).toBeTruthy();
      expect(tabContent?.getAttribute("style")).toContain("animation: none");
    });
  });

  // ── Responsive layout ─────────────────────────────────────────────────────
  //
  // jsdom does not process CSS media queries, so these tests verify the
  // structural contracts that enable correct responsive behaviour at runtime:
  //
  //   1. CTA row uses the CSS class that carries the breakpoint rules — NOT an
  //      inline `display:"flex"` that would override media-query styles.
  //   2. Key layout containers carry their expected class names so the
  //      breakpoint rules defined in index.css can reach them.
  //   3. Print-hidden elements carry `.no-print` so they are suppressed in
  //      print output (enforced by the `@media print` block in index.css).
  //   4. Sticky tab bar carries both the sticky class and `padding-bottom`
  //      (merged into the base rule) to avoid overlap with content below.
  //   5. The sidebar rail carries the CSS class that triggers its sticky →
  //      static 2-column transition at ≤ 980 px.

  describe("responsive layout", () => {
    it("CTA row uses the CSS class instead of an inline display style", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // The CTA row must carry the class that provides responsive flex/column
      // behaviour via media queries. An inline `display` style would override
      // the CSS rules and prevent the mobile-stack from working.
      const ctaRow = document.querySelector(".api-hero__cta--detail");
      expect(ctaRow).toBeTruthy();

      // Must NOT have an inline display property that would block the CSS
      const inlineDisplay = (ctaRow as HTMLElement)?.style?.display;
      expect(inlineDisplay).toBeFalsy();
    });

    it("CTA row has no inline gap or padding that would override CSS breakpoints", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const ctaRow = document.querySelector(".api-hero__cta--detail") as HTMLElement;
      expect(ctaRow).toBeTruthy();

      // The inline style object must be empty (or absent) so media queries win.
      expect(ctaRow.style.gap).toBe("");
      expect(ctaRow.style.padding).toBe("");
    });

    it("CTA row also carries the base api-hero__cta class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const ctaRow = document.querySelector(".api-hero__cta");
      expect(ctaRow).toBeTruthy();
      // And it should be the same element as the --detail modifier.
      expect(ctaRow?.classList.contains("api-hero__cta--detail")).toBe(true);
    });

    it("CTA row carries the no-print class to suppress it in print output", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const ctaRow = document.querySelector(".api-hero__cta--detail");
      expect(ctaRow?.classList.contains("no-print")).toBe(true);
    });

    it("hero section uses the api-detail-hero CSS class for responsive grid", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // The grid that switches from 2-col to 1-col at ≤ 980 px.
      expect(document.querySelector(".api-detail-hero")).toBeTruthy();
    });

    it("content area uses the api-detail-content-grid class for sidebar responsive layout", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // The grid that collapses the 340px sidebar below at ≤ 980 px.
      expect(document.querySelector(".api-detail-content-grid")).toBeTruthy();
    });

    it("sidebar inner uses the api-detail-sidebar-inner class (sticky → 2-col → 1-col)", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // sticky at desktop, 2-column at ≤ 980 px, 1-column at ≤ 720 px.
      expect(document.querySelector(".api-detail-sidebar-inner")).toBeTruthy();
    });

    it("metrics grid uses the api-detail-metrics class (3-col → 2-col → 1-col)", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // 3-col base → 2-col at ≤ 720 px (min 481 px) → 1-col below.
      expect(document.querySelector(".api-detail-metrics")).toBeTruthy();
    });

    it("overview two-column section uses the api-detail-two-column class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // auto-fill at mid range (721–980 px), 1-col at ≤ 720 px.
      expect(document.querySelector(".api-detail-two-column")).toBeTruthy();
    });

    it("tab bar carries the api-detail-tabs sticky class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // Base rule adds position:sticky, z-index:20, and padding-bottom:4px.
      expect(document.querySelector(".api-detail-tabs")).toBeTruthy();
    });

    it("sidebar element carries the no-print class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const sidebar = document.querySelector(".api-detail-sidebar");
      expect(sidebar).toBeTruthy();
      expect(sidebar?.classList.contains("no-print")).toBe(true);
    });

    it("tab navigation carries the no-print class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const tabs = document.querySelector(".api-detail-tabs");
      expect(tabs).toBeTruthy();
      expect(tabs?.classList.contains("no-print")).toBe(true);
    });

    it("container is bounded by api-detail-container for wide viewport max-width", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // max-width: 1280px in the base rule ensures content is capped on wide screens.
      expect(document.querySelector(".api-detail-container")).toBeTruthy();
    });

    it("pricing grid uses the api-detail-pricing-grid class (2-col → 1-col)", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      // 2-col base, collapses to 1-col at ≤ 720 px.
      expect(document.querySelector(".api-detail-pricing-grid")).toBeTruthy();
    });

    it("CTA row contains at least two interactive buttons", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const ctaRow = document.querySelector(".api-hero__cta--detail");
      expect(ctaRow).toBeTruthy();

      const buttons = ctaRow?.querySelectorAll("button");
      // "Try API", "View Pricing", and SubscribeButton
      expect((buttons?.length ?? 0)).toBeGreaterThanOrEqual(2);
    });
  });

  describe("keyboard navigation and focus", () => {
    it("ensures tabpanels are focusable to support visible focus outlines (see focus.css)", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const overviewPanel = screen.getByRole("tabpanel", { name: "Overview" });
      expect(overviewPanel).toBeTruthy();
      expect(overviewPanel.tabIndex).toBe(0);

      fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
      const docPanel = screen.getByRole("tabpanel", { name: "Documentation" });
      expect(docPanel).toBeTruthy();
      expect(docPanel.tabIndex).toBe(0);
    });
  });
});
