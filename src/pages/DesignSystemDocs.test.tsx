// @vitest-environment jsdom
/**
 * Tests for DesignSystemDocs (src/pages/DesignSystemDocs.tsx).
 *
 * Coverage scope:
 *   - Page heading and meta title.
 *   - Tab navigation (Components, Colours, Typography, Tokens, Utilities).
 *   - Component accordion: default open state, expand-all, collapse-all, individual toggle.
 *   - Search: filter by name, token, and description; empty-state; clear search.
 *   - Aria-live announcement of search results.
 *   - Usage snippet copy button label.
 *   - Colour palette, typography, token, and utility panels rendered.
 *   - No accessibility regressions: aria-expanded, aria-controls, aria-selected.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesignSystemDocs from "./DesignSystemDocs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to a named tab. */
function clickTab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("DesignSystemDocs", () => {
  afterEach(() => {
    cleanup();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  it("renders the page heading", () => {
    render(<DesignSystemDocs />);
    expect(screen.getByRole("heading", { name: "Design System", level: 1 })).toBeTruthy();
  });

  it("renders the eyebrow label 'Internal reference'", () => {
    render(<DesignSystemDocs />);
    // There may be multiple eyebrow elements on the page; assert at least one exists
    const labels = screen.getAllByText("Internal reference");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all five tabs", () => {
    render(<DesignSystemDocs />);
    const tabNames = ["Components", "Colours", "Typography", "Tokens", "Utilities"];
    for (const name of tabNames) {
      expect(screen.getByRole("tab", { name })).toBeTruthy();
    }
  });

  // ── Tab navigation ────────────────────────────────────────────────────────

  it("shows the Components panel by default", () => {
    render(<DesignSystemDocs />);
    const tab = screen.getByRole("tab", { name: "Components" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    // The accordion h2 for "Primary Button" must exist (level-2 heading in the component panel)
    expect(
      screen.getAllByRole("heading", { name: "Primary Button" }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("switches to the Colours panel when the Colours tab is clicked", () => {
    render(<DesignSystemDocs />);
    clickTab("Colours");
    const colTab = screen.getByRole("tab", { name: "Colours" });
    expect(colTab.getAttribute("aria-selected")).toBe("true");
    // Colour palette heading
    expect(screen.getByRole("heading", { name: "Colour Tokens" })).toBeTruthy();
  });

  it("switches to the Typography panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Typography");
    expect(screen.getByRole("heading", { name: "Typography Scale" })).toBeTruthy();
  });

  it("switches to the Tokens panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Tokens");
    expect(screen.getByRole("heading", { name: "Spacing & Radius Tokens" })).toBeTruthy();
  });

  it("switches to the Utilities panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Utilities");
    expect(screen.getByRole("heading", { name: "CSS Utility Classes" })).toBeTruthy();
  });

  it("marks exactly one tab as selected at a time", () => {
    render(<DesignSystemDocs />);
    clickTab("Colours");
    const tabs = screen.getAllByRole("tab");
    const selected = tabs.filter((t) => t.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("Colours");
  });

  // ── Component accordion ───────────────────────────────────────────────────

  it("opens the first component (Primary Button) by default", () => {
    render(<DesignSystemDocs />);
    // The live example section inside the first accordion
    expect(screen.getAllByText("Live example").length).toBeGreaterThanOrEqual(1);
  });

  it("collapses all accordions when 'Collapse all' is clicked", () => {
    render(<DesignSystemDocs />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryAllByText("Live example")).toHaveLength(0);
  });

  it("expands all accordions when 'Expand all' is clicked", () => {
    render(<DesignSystemDocs />);
    // Collapse first, then expand
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    // All COMPONENT_DOCS entries should have a 'Live example' label visible
    const labels = screen.queryAllByText("Live example");
    expect(labels.length).toBeGreaterThan(1);
  });

  it("toggles a single accordion open and closed", () => {
    render(<DesignSystemDocs />);
    // Collapse everything first for a clean slate
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryAllByText("Live example")).toHaveLength(0);

    // Click the "Secondary Button" accordion trigger
    const trigger = screen.getByRole("button", { name: "Secondary Button" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryAllByText("Live example").length).toBeGreaterThanOrEqual(1);

    // Click again to collapse
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryAllByText("Live example")).toHaveLength(0);
  });

  it("sets aria-expanded correctly on each accordion trigger", () => {
    render(<DesignSystemDocs />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    const trigger = screen.getByRole("button", { name: "Primary Button" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("links each accordion trigger to its body via aria-controls", () => {
    render(<DesignSystemDocs />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    // Every trigger must have an aria-controls referencing an element in the DOM
    const triggers = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-expanded") !== null);
    for (const trigger of triggers) {
      const controlsId = trigger.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();
      expect(document.getElementById(controlsId!)).toBeTruthy();
    }
  });

  // ── Search ────────────────────────────────────────────────────────────────

  it("filters components by name when the user types in the search box", () => {
    render(<DesignSystemDocs />);
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    fireEvent.change(search, { target: { value: "Primary Button" } });
    // Only primary-button section should be shown
    expect(screen.getByRole("heading", { name: "Primary Button", level: 2 })).toBeTruthy();
    // Secondary Button should no longer be in the DOM
    expect(screen.queryByRole("heading", { name: "Secondary Button", level: 2 })).toBeNull();
  });

  it("filters components by design token name", () => {
    render(<DesignSystemDocs />);
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    // "--danger" is used by Status Chip and Danger Button
    fireEvent.change(search, { target: { value: "--danger" } });
    // At least the danger-button should appear
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent ?? "");
    expect(headings.some((h) => h.includes("Danger"))).toBe(true);
    // Primary button (no --danger token) should not appear
    expect(headings.some((h) => h === "Primary Button")).toBe(false);
  });

  it("filters components by description keyword", () => {
    render(<DesignSystemDocs />);
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    fireEvent.change(search, { target: { value: "shimmer" } });
    // Skeleton uses "shimmer" in its description
    expect(screen.getByRole("heading", { name: "Skeleton", level: 2 })).toBeTruthy();
  });

  it("shows empty-state message when no components match the search", () => {
    render(<DesignSystemDocs />);
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    fireEvent.change(search, { target: { value: "xyznonexistent" } });
    expect(screen.getByText(/No components match/i)).toBeTruthy();
  });

  it("restores all components when the clear-search button is clicked", () => {
    render(<DesignSystemDocs />);
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    fireEvent.change(search, { target: { value: "nonexistent" } });
    expect(screen.queryByRole("heading", { name: "Primary Button", level: 2 })).toBeNull();

    // There are two "Clear search" targets: the ✕ inline button (aria-label) and the
    // empty-state "Clear search" text button. Click the first one available.
    const clearBtns = screen.getAllByRole("button", { name: /Clear search/i });
    fireEvent.click(clearBtns[0]);
    expect(screen.getByRole("heading", { name: "Primary Button", level: 2 })).toBeTruthy();
  });

  it("clears the search field when the X button inside the input is clicked", () => {
    render(<DesignSystemDocs />);
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    fireEvent.change(search, { target: { value: "skeleton" } });

    const clearBtn = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearBtn);

    expect((search as HTMLInputElement).value).toBe("");
  });

  it("auto-expands all accordions when a search query is entered", () => {
    render(<DesignSystemDocs />);
    // Collapse everything first
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryAllByText("Live example")).toHaveLength(0);

    // Type a query that matches multiple components
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    fireEvent.change(search, { target: { value: "button" } });
    // Matching entries should be expanded
    expect(screen.queryAllByText("Live example").length).toBeGreaterThan(0);
  });

  // ── Aria-live search result announcement ──────────────────────────────────

  it("announces search result count via aria-live region", () => {
    render(<DesignSystemDocs />);
    const search = screen.getByRole("searchbox", { name: "Filter components" });
    fireEvent.change(search, { target: { value: "skeleton" } });
    // The sr-only live region should contain the count
    const liveRegion = document.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.textContent).toMatch(/1 component found/i);
  });

  // ── Copy button ───────────────────────────────────────────────────────────

  it("renders copy buttons for usage snippets when a component is expanded", () => {
    render(<DesignSystemDocs />);
    // Expand all to surface all usage sections
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    // Copy buttons should be present
    const copyBtns = screen.getAllByRole("button", { name: /Copy usage snippet/i });
    expect(copyBtns.length).toBeGreaterThan(0);
  });

  it("renders the copy button with 'Copy' label initially", () => {
    render(<DesignSystemDocs />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    const copyBtns = screen.getAllByRole("button", { name: /Copy usage snippet/i });
    // First button should show "Copy" as text
    expect(copyBtns[0].textContent).toBe("Copy");
  });

  // ── Colour palette panel ──────────────────────────────────────────────────

  it("renders colour group labels in the Colours panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Colours");
    const groupLabels = ["Background", "Text", "Brand & Actions", "Semantic", "Borders"];
    for (const label of groupLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("renders individual token names in the colour palette", () => {
    render(<DesignSystemDocs />);
    clickTab("Colours");
    // Scope to the colours panel to avoid collision with token chips in open accordions
    const panel = document.getElementById("panel-colours")!;
    expect(within(panel).getByText("--page-bg")).toBeTruthy();
    // --accent and --danger may appear in multiple panels; at least one per panel is fine
    expect(within(panel).getAllByText("--accent").length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getAllByText("--danger").length).toBeGreaterThanOrEqual(1);
  });

  // ── Typography panel ──────────────────────────────────────────────────────

  it("renders typography specimen labels in the Typography panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Typography");
    expect(screen.getByText("H1")).toBeTruthy();
    expect(screen.getByText("Eyebrow label")).toBeTruthy();
    expect(screen.getByText("Helper text")).toBeTruthy();
  });

  // ── Tokens panel ─────────────────────────────────────────────────────────

  it("renders spacing token names in the Tokens panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Tokens");
    expect(screen.getByText("--radius-xl")).toBeTruthy();
    expect(screen.getByText("--radius-lg")).toBeTruthy();
    expect(screen.getByText("--transition-speed")).toBeTruthy();
  });

  // ── Utilities panel ───────────────────────────────────────────────────────

  it("renders CSS utility class names in the Utilities panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Utilities");
    // Spot-check a few expected classes
    expect(screen.getByText(".primary-button")).toBeTruthy();
    expect(screen.getByText(".surface")).toBeTruthy();
    expect(screen.getByText(".sr-only")).toBeTruthy();
  });

  it("renders utility category headings in the Utilities panel", () => {
    render(<DesignSystemDocs />);
    clickTab("Utilities");
    // Scope to the utilities panel to avoid collision with the tab button named "Typography"
    const panel = document.getElementById("panel-utilities")!;
    expect(within(panel).getByText("Buttons")).toBeTruthy();
    expect(within(panel).getByText("Layout")).toBeTruthy();
    expect(within(panel).getByText("Typography")).toBeTruthy();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it("each tab has role=tab and the panel has role=tabpanel", () => {
    render(<DesignSystemDocs />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(5);
    // Active panel should have role tabpanel
    const panel = screen.getByRole("tabpanel", { hidden: false });
    expect(panel).toBeTruthy();
  });

  it("each tab panel is linked to its tab via aria-labelledby", () => {
    render(<DesignSystemDocs />);
    for (const tab of TABS_TEST_DATA) {
      clickTab(tab.label);
      const panel = document.getElementById(`panel-${tab.id}`)!;
      expect(panel).toBeTruthy();
      expect(panel.getAttribute("aria-labelledby")).toBe(`tab-${tab.id}`);
    }
  });

  it("search input has role=searchbox and is inside a search landmark", () => {
    render(<DesignSystemDocs />);
    const searchLandmark = screen.getByRole("search");
    const input = within(searchLandmark).getByRole("searchbox");
    expect(input).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Constants used in tests (mirrors TABS from the component)
// ---------------------------------------------------------------------------
const TABS_TEST_DATA = [
  { id: "components", label: "Components" },
  { id: "colours", label: "Colours" },
  { id: "typography", label: "Typography" },
  { id: "tokens", label: "Tokens" },
  { id: "utilities", label: "Utilities" },
] as const;

// Suppress "useId requires a unique id" warnings in jsdom
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  let counter = 0;
  return {
    ...actual,
    useId: () => `:r${counter++}:`,
  };
});
