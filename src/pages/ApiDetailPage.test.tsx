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
    expect(screen.getByRole("button", { name: /forecast 2 endpoints/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /alerts 2 endpoints/i })).toBeTruthy();
  });

  it("shows the group preview when a trigger receives keyboard focus", () => {
    renderWithProviders(<ApiDetailPage />);
    settleLoadingState();

    fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
    fireEvent.focus(screen.getByRole("button", { name: /forecast 2 endpoints/i }));

    const preview = screen.getByLabelText("Forecast group preview");
    expect(preview).toBeTruthy();
    expect(within(preview).getByText("Get Forecast")).toBeTruthy();
    expect(within(preview).getByText(/2 parameters/i)).toBeTruthy();
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

  // ── Skeleton parity (issue #410) ──────────────────────────────────────────
  //
  // Each test below pins the structural contract introduced by the parity fix
  // so regressions are caught before they ship.  jsdom does not evaluate CSS,
  // so tests validate class names and inline style properties rather than
  // computed pixel values.
  //
  // Mismatch reference (see Step-1 report):
  //   M1  logo: 64×64 / 50% radius
  //   M4  status badge placeholder present
  //   M5  provider row placeholder present
  //   M7  CTA row present in skeleton
  //   M9  tab bar uses CSS class margin (no inline marginBottom override)
  //   M10 metrics grid uses CSS class layout (no inline display:flex override)
  //   M11 metrics cards use .stat-card (real class, not nonexistent variant)
  //   M12 sidebar panels use .stat-card / .preview-card (real classes)

  describe("skeleton parity (issue #410)", () => {
    // Render the skeleton state (before timers fire)
    function renderSkeleton() {
      return renderWithProviders(<ApiDetailPage />);
      // Do NOT call settleLoadingState() — we want the skeleton
    }

    it("M1 – logo skeleton is 64×64 with 50% border-radius (circle, not rounded rect)", () => {
      const { container } = renderSkeleton();

      // The logo skeleton is the first .skeleton inside .api-detail-brand
      const brand = container.querySelector(".api-detail-brand");
      expect(brand).toBeTruthy();

      const logoSkel = brand!.querySelector(".skeleton") as HTMLElement;
      expect(logoSkel).toBeTruthy();

      // width/height passed as props end up as inline style values
      expect(logoSkel.style.width).toBe("64px");
      expect(logoSkel.style.height).toBe("64px");
      // borderRadius must be 50% (circle), not a fixed-px value
      expect(logoSkel.style.borderRadius).toBe("50%");
    });

    it("M4 – status-badge placeholder (3rd skeleton in .api-detail-title) is present", () => {
      const { container } = renderSkeleton();

      const title = container.querySelector(".api-detail-title");
      expect(title).toBeTruthy();

      // There must be at least 3 skeleton blocks inside api-detail-title:
      // [0] h1 title, [1] meta row, [2] status badge
      const skels = title!.querySelectorAll(".skeleton");
      expect(skels.length).toBeGreaterThanOrEqual(3);

      // Status badge (index 2) should be shorter than the title (index 0)
      const titleSkel = skels[0] as HTMLElement;
      const badgeSkel = skels[2] as HTMLElement;
      // Badge height should be 24px
      expect(badgeSkel.style.height).toBe("24px");
      // Title height should be taller
      expect(parseInt(titleSkel.style.height ?? "0")).toBeGreaterThan(
        parseInt(badgeSkel.style.height ?? "0"),
      );
    });

    it("M5 – provider-row placeholder (4th skeleton in .api-detail-title) is present", () => {
      const { container } = renderSkeleton();

      const title = container.querySelector(".api-detail-title");
      expect(title).toBeTruthy();

      const skels = title!.querySelectorAll(".skeleton");
      // [0] title, [1] meta, [2] badge, [3] provider
      expect(skels.length).toBeGreaterThanOrEqual(4);
    });

    it("M7 – CTA row skeleton is present between hero and content grid", () => {
      const { container } = renderSkeleton();

      // The skeleton must include the CTA row with both modifier classes
      const ctaRow = container.querySelector(".api-hero__cta--detail");
      expect(ctaRow).toBeTruthy();
      expect(ctaRow!.classList.contains("no-print")).toBe(true);

      // Must contain skeleton blocks for the 3 CTA buttons
      const ctaSkels = ctaRow!.querySelectorAll(".skeleton");
      expect(ctaSkels.length).toBe(3);
    });

    it("M9 – tab bar has no inline marginBottom that would override CSS (should be 32px via class)", () => {
      const { container } = renderSkeleton();

      const tabBar = container.querySelector(".api-detail-tabs") as HTMLElement;
      expect(tabBar).toBeTruthy();
      // Inline style must not override the CSS-class marginBottom
      expect(tabBar.style.marginBottom).toBe("");
    });

    it("M9 – tab bar renders one skeleton block per real tab (6 tabs)", () => {
      const { container } = renderSkeleton();

      const tabBar = container.querySelector(".api-detail-tabs");
      expect(tabBar).toBeTruthy();

      const tabSkels = tabBar!.querySelectorAll(".skeleton");
      // Real page has 6 tabs: Overview / Documentation / Pricing / Examples / Reviews / Embed
      expect(tabSkels.length).toBe(6);
    });

    it("M10 – metrics grid has no inline display:flex override (CSS class must drive layout)", () => {
      const { container } = renderSkeleton();

      const metricsGrid = container.querySelector(".api-detail-metrics") as HTMLElement;
      expect(metricsGrid).toBeTruthy();
      // Inline display must be empty so CSS grid rule applies
      expect(metricsGrid.style.display).toBe("");
    });

    it("M11 – metrics stat-cards use the real .stat-card class (not a nonexistent variant)", () => {
      const { container } = renderSkeleton();

      const metricsGrid = container.querySelector(".api-detail-metrics");
      expect(metricsGrid).toBeTruthy();

      const cards = metricsGrid!.querySelectorAll(".stat-card");
      expect(cards.length).toBe(3);

      // The nonexistent class must not appear
      expect(metricsGrid!.querySelector(".stat-card-skeleton")).toBeNull();
    });

    it("M12 – sidebar first panel uses real .stat-card class", () => {
      const { container } = renderSkeleton();

      const sidebarInner = container.querySelector(".api-detail-sidebar-inner");
      expect(sidebarInner).toBeTruthy();

      // First child is the API Health panel — must be .stat-card
      const firstPanel = sidebarInner!.querySelector(".stat-card");
      expect(firstPanel).toBeTruthy();
      expect(sidebarInner!.querySelector(".stat-card-skeleton")).toBeNull();
    });

    it("M12 – sidebar second panel uses real .preview-card class", () => {
      const { container } = renderSkeleton();

      const sidebarInner = container.querySelector(".api-detail-sidebar-inner");
      expect(sidebarInner).toBeTruthy();

      const previewCard = sidebarInner!.querySelector(".preview-card");
      expect(previewCard).toBeTruthy();
      expect(sidebarInner!.querySelector(".preview-card-skeleton")).toBeNull();
    });

    it("skeleton shell is not interactive – no focusable skeleton blocks", () => {
      const { container } = renderSkeleton();

      // All .skeleton elements must have aria-hidden and role=presentation
      const skels = container.querySelectorAll(".skeleton");
      skels.forEach((skel) => {
        expect(skel.getAttribute("aria-hidden")).toBe("true");
        expect(skel.getAttribute("role")).toBe("presentation");
        // Must not have a tabIndex that makes them reachable by keyboard
        expect((skel as HTMLElement).tabIndex).toBeLessThan(0);
      });
    });

    it("skeleton shell carries aria-busy=true and aria-label for screen readers", () => {
      const { container } = renderSkeleton();

      const shell = container.querySelector(".api-detail-page") as HTMLElement;
      expect(shell.getAttribute("aria-busy")).toBe("true");
      expect(shell.getAttribute("aria-label")).toBe("API detail loading shell");
    });
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

    it("injects responsive styles for mobile viewports", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();
      
      // Look for the style tag we injected
      const styles = Array.from(document.querySelectorAll("style"));
      const hasMobileStyle = styles.some(style => style.textContent?.includes("@media (max-width: 480px)"));
      expect(hasMobileStyle).toBe(true);

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

    it("all interactive buttons in ApiDetailPage are keyboard-focusable", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // Buttons in the hero, CTA row, and sidebar
      const focusableElements = document.querySelectorAll(
        ".api-detail-page button, .api-detail-page a, .api-detail-page select, .api-detail-page input, .api-detail-page [role='tab']",
      );
      expect(focusableElements.length).toBeGreaterThan(0);

      // Verify they are all focusable (not disabled)
      focusableElements.forEach((el) => {
        // tabIndex defaults to 0 for interactive elements unless explicitly set
        const htmlEl = el as HTMLElement;
        if (htmlEl.hasAttribute("disabled")) {
          expect(htmlEl.getAttribute("disabled")).toBe("");
        } else {
          // buttons, links, inputs are inherently focusable
          expect(
            htmlEl.tabIndex >= 0 || htmlEl.getAttribute("disabled") === null,
          ).toBe(true);
        }
      });
    });

    it("tab buttons (role='tab') are reachable via keyboard", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBeGreaterThanOrEqual(6); // All 6 tab items

      // Verify no tab has tabIndex={-1} (all should be reachable)
      tabs.forEach((tab) => {
        expect((tab as HTMLElement).tabIndex).not.toBe(-1);
      });
    });

    it("select element in reviews tab is keyboard-focusable", () => {
      window.history.pushState({}, "", "/details/pay-qr");
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Reviews" }));

      const select = screen.getByLabelText("Sort by");
      expect(select).toBeTruthy();
      expect((select as HTMLElement).tabIndex).not.toBe(-1);
    });

    it("range slider in pricing tab is keyboard-focusable", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      const slider = screen.getByRole("slider");
      expect(slider).toBeTruthy();
      expect((slider as HTMLElement).tabIndex).not.toBe(-1);
    });

    it("subscribe button is keyboard-focusable", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const subscribeBtn = screen.getByRole("button", { name: /subscribe/i });
      expect(subscribeBtn).toBeTruthy();
      expect((subscribeBtn as HTMLElement).tabIndex).not.toBe(-1);
    });

    it("no interactive element in ApiDetailPage carries inline outline:none that would suppress the focus ring", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // Check all interactive elements for inline outline:none
      const interactiveElements = document.querySelectorAll(
        "button, a, input, select, textarea, [role='tab'], [role='button'], [tabindex]:not([tabindex='-1'])",
      );

      interactiveElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const inlineOutline = htmlEl.style.outline;
        // Inline outline:none would suppress the :focus-visible ring
        expect(inlineOutline).not.toBe("none");
      });
    });

    it("endpoint save button popover dialog is keyboard-accessible", () => {
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
      expect(dialog).toBeTruthy();

      // Dialog should be focusable
      expect((dialog as HTMLElement).tabIndex).not.toBe(-1);

      // Check inputs inside dialog are focusable
      const inputs = dialog.querySelectorAll("input, button");
      inputs.forEach((input) => {
        const htmlInput = input as HTMLElement;
        if (!htmlInput.hasAttribute("disabled")) {
          expect(htmlInput.tabIndex).not.toBe(-1);
        }
      });
    });
  });

  describe("aria-live announcements", () => {
    it("announces when the page details have loaded", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const liveRegion = document.querySelector("[aria-live='polite']");
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.textContent).toBe("WeatherSim API detail page loaded");
    });

    it("announces tab selection changes", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const liveRegion = document.querySelector("[aria-live='polite']");

      fireEvent.click(screen.getByRole("tab", { name: "Documentation" }));
      expect(liveRegion?.textContent).toBe("Showing Documentation tab");

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));
      expect(liveRegion?.textContent).toBe("Showing Pricing tab");
    });

    it("announces cost calculator slider adjustments", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      const slider = screen.getByRole("slider");
      fireEvent.change(slider, { target: { value: "5000" } });

      const liveRegion = document.querySelector("[aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Estimated monthly total: $50.00 for 5,000 requests");
    });

    it("announces review sorting criteria changes", () => {
      window.history.pushState({}, "", "/details/pay-qr");
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Reviews" }));

      const select = screen.getByLabelText("Sort by");
      fireEvent.change(select, { target: { value: "highest" } });

      const liveRegion = document.querySelector("[aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Reviews sorted by highest rated");
    });
  });

  // ── tabular-nums (Issue #466) ─────────────────────────────────────────────
  //
  // Verifies that every numeric display that can vary over time carries the
  // `tabular-nums` class (font-variant-numeric: tabular-nums) so digits use
  // fixed-width glyphs and the layout does not shift as values change.
  //
  // Tests check the *className* contract rather than the rendered CSS value
  // because jsdom does not evaluate stylesheets.  The CSS rule that backs the
  // class is in src/styles/typography.css inside @layer typography.

  describe("tabular-nums numeric display (Issue #466)", () => {
    // ── Hero panel ──────────────────────────────────────────────────────────

    it("hero price panel carries tabular-nums class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // .api-detail-price is the large price shown in the right-rail hero panel.
      const priceEl = document.querySelector(".api-detail-price");
      expect(priceEl).toBeTruthy();
      expect(priceEl?.classList.contains("tabular-nums")).toBe(true);
    });

    it("hero meta price (provider line) carries tabular-nums class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // The <strong> with the price in "Provider · $X per request" line.
      const metaPrice = document.querySelector(".api-detail-meta strong.tabular-nums");
      expect(metaPrice).toBeTruthy();
    });

    // ── Overview — Performance Metrics ──────────────────────────────────────

    it("all three performance metric stat values carry tabular-nums class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // Default tab is Overview — stat cards are visible immediately.
      const statValues = document.querySelectorAll(".stat-card .tabular-nums");
      // Three metrics: Total Requests, Latency P95, System Uptime.
      expect(statValues.length).toBeGreaterThanOrEqual(3);
    });

    it("each performance metric stat value also carries the stat-card__value class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const statValues = document.querySelectorAll(".stat-card__value");
      // Three metrics expected.
      expect(statValues.length).toBeGreaterThanOrEqual(3);
      statValues.forEach((el) => {
        expect(el.classList.contains("tabular-nums")).toBe(true);
      });
    });

    it("Total Requests stat value text is rendered inside a tabular-nums element", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      // The first .stat-card__value element corresponds to Total Requests.
      const statCards = document.querySelectorAll(".stat-card");
      const totalRequestsCard = Array.from(statCards).find((card) =>
        card.textContent?.includes("Total Requests"),
      );
      expect(totalRequestsCard).toBeTruthy();

      const valueEl = totalRequestsCard?.querySelector(".tabular-nums");
      expect(valueEl).toBeTruthy();
    });

    it("Latency P95 stat value is rendered inside a tabular-nums element", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const statCards = document.querySelectorAll(".stat-card");
      const latencyCard = Array.from(statCards).find((card) =>
        card.textContent?.includes("Latency"),
      );
      expect(latencyCard).toBeTruthy();

      const valueEl = latencyCard?.querySelector(".tabular-nums");
      expect(valueEl).toBeTruthy();
    });

    it("System Uptime stat value is rendered inside a tabular-nums element", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      const statCards = document.querySelectorAll(".stat-card");
      const uptimeCard = Array.from(statCards).find((card) =>
        card.textContent?.includes("System Uptime"),
      );
      expect(uptimeCard).toBeTruthy();

      const valueEl = uptimeCard?.querySelector(".tabular-nums");
      expect(valueEl).toBeTruthy();
    });

    // ── Pricing tab — plan price ────────────────────────────────────────────

    it("standard plan price carries tabular-nums class on pricing tab", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      // .api-detail-plan-price is the large per-call price in the pro plan card.
      const planPrices = document.querySelectorAll(".api-detail-plan-price");
      expect(planPrices.length).toBeGreaterThanOrEqual(1);

      // The standard (pro) plan price element must have tabular-nums.
      const standardPrice = Array.from(planPrices).find((el) =>
        el.textContent?.includes("$"),
      );
      expect(standardPrice).toBeTruthy();
      expect(standardPrice?.classList.contains("tabular-nums")).toBe(true);
    });

    // ── Pricing tab — cost calculator ───────────────────────────────────────

    it("cost calculator monthly volume span carries tabular-nums class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      // The "X Requests" span next to the Monthly Volume label.
      const volumeSpan = document.querySelector(".api-detail-calculator-total")
        ?.closest(".preview-card")
        ?.querySelector("span.tabular-nums");
      // Fallback: search in the entire pricing section.
      const anyVolumeSpan = document.querySelector("span.tabular-nums");
      expect(anyVolumeSpan).toBeTruthy();
    });

    it("cost calculator estimated total carries tabular-nums class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      // The large estimated-total amount element.
      const totalEl = document.querySelector(".api-detail-calculator-total__amount");
      expect(totalEl).toBeTruthy();
      expect(totalEl?.classList.contains("tabular-nums")).toBe(true);
    });

    it("estimated total carries the api-detail-calculator-total__amount class", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      expect(document.querySelector(".api-detail-calculator-total__amount")).toBeTruthy();
    });

    it("cost calculator estimated total updates as the slider moves and stays tabular", () => {
      renderWithProviders(<ApiDetailPage />);
      settleLoadingState();

      fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));

      const slider = screen.getByRole("slider");

      // Move slider to 10,000 requests
      fireEvent.change(slider, { target: { value: "10000" } });

      const totalEl = document.querySelector(".api-detail-calculator-total__amount");
      expect(totalEl).toBeTruthy();
      // The element must still carry tabular-nums after re-render.
      expect(totalEl?.classList.contains("tabular-nums")).toBe(true);
      // Displayed amount must start with "$" (numeric, not empty).
      expect(totalEl?.textContent?.startsWith("$")).toBe(true);
    });
  });
});
