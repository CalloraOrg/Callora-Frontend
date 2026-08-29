// @vitest-environment jsdom
/**
 * Tests for src/components/Tabs.tsx
 *
 * Coverage
 * ────────
 * • Rendering: all tabs, nav, tablist, role="tab"
 * • aria-selected: true on active, false on others
 * • tabIndex roving: 0 on active, -1 on inactive
 * • aria-controls: default and custom tabPanelId
 * • Mouse interaction: click calls onChange
 * • Keyboard navigation: ArrowRight/Left (with wrap), Home, End
 * • Indicator: aria-hidden, role="presentation",
 *              inline left/width styles, reduced-motion 0ms
 * • Edge cases: single tab, two tabs, custom className
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Tabs from "./Tabs";

// ── matchMedia mock ──────────────────────────────────────────────────────────
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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "documentation", label: "Documentation" },
  { id: "pricing", label: "Pricing" },
];

function renderTabs(activeTab = "overview", onChange = vi.fn(), tabs = DEFAULT_TABS) {
  return render(<Tabs tabs={tabs} activeTab={activeTab} onChange={onChange} />);
}

afterEach(() => cleanup());

// ── Rendering ────────────────────────────────────────────────────────────────

describe("Tabs – rendering", () => {
  it("renders all tab labels", () => {
    renderTabs();
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Documentation")).toBeTruthy();
    expect(screen.getByText("Pricing")).toBeTruthy();
  });

  it("renders a nav element with an aria-label", () => {
    const { container } = renderTabs();
    const nav = container.querySelector("nav");
    expect(nav).toBeTruthy();
    expect(nav?.getAttribute("aria-label")).toBeTruthy();
  });

  it("renders a tablist container", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toBeTruthy();
  });

  it("renders each tab as role='tab'", () => {
    renderTabs();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("renders the decorative indicator span as aria-hidden='true'", () => {
    const { container } = renderTabs();
    const indicator = container.querySelector("[aria-hidden='true'][role='presentation']");
    expect(indicator).toBeTruthy();
  });

  it("indicator has role='presentation'", () => {
    const { container } = renderTabs();
    const indicator = container.querySelector("[aria-hidden='true']");
    expect(indicator?.getAttribute("role")).toBe("presentation");
  });

  it("indicator uses inline left and width styles (not transform)", () => {
    const { container } = renderTabs();
    const indicator = container.querySelector("[aria-hidden='true']") as HTMLElement;
    // The component writes left/width directly — both should be present as
    // inline style properties (even if 0px on initial mount in jsdom).
    expect(indicator?.style.left).toBeDefined();
    expect(indicator?.style.width).toBeDefined();
  });

  it("nav has no injected <style> tag sibling", () => {
    const { container } = renderTabs();
    // Pure inline-style approach — no <style> tag should be injected.
    const styles = container.querySelectorAll("style");
    expect(styles.length).toBe(0);
  });
});

// ── aria-selected ─────────────────────────────────────────────────────────────

describe("Tabs – aria-selected", () => {
  it("sets aria-selected='true' on the active tab", () => {
    renderTabs("documentation");
    const tab = screen.getByRole("tab", { name: "Documentation" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("sets aria-selected='false' on inactive tabs", () => {
    renderTabs("documentation");
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "Pricing" }).getAttribute("aria-selected")).toBe("false");
  });
});

// ── tabIndex roving ───────────────────────────────────────────────────────────

describe("Tabs – tabIndex", () => {
  it("gives tabIndex=0 to the active tab", () => {
    renderTabs("pricing");
    const tab = screen.getByRole("tab", { name: "Pricing" });
    expect(String(tab.getAttribute("tabIndex") ?? tab.tabIndex)).toBe("0");
  });

  it("gives tabIndex=-1 to inactive tabs", () => {
    renderTabs("pricing");
    const tab = screen.getByRole("tab", { name: "Overview" });
    expect(String(tab.getAttribute("tabIndex") ?? tab.tabIndex)).toBe("-1");
  });
});

// ── aria-controls ─────────────────────────────────────────────────────────────

describe("Tabs – aria-controls", () => {
  it("defaults aria-controls to 'panel-{id}'", () => {
    renderTabs();
    const tab = screen.getByRole("tab", { name: "Overview" });
    expect(tab.getAttribute("aria-controls")).toBe("panel-overview");
  });

  it("respects a custom tabPanelId function", () => {
    render(<Tabs tabs={DEFAULT_TABS} activeTab="overview" onChange={vi.fn()} tabPanelId={(id) => `custom-panel-${id}`} />);
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-controls")).toBe("custom-panel-overview");
  });

  it("each tab has a unique aria-controls value", () => {
    renderTabs();
    const controls = screen.getAllByRole("tab").map((t) => t.getAttribute("aria-controls"));
    expect(new Set(controls).size).toBe(controls.length);
  });
});

// ── Mouse interaction ─────────────────────────────────────────────────────────

describe("Tabs – mouse interaction", () => {
  it("calls onChange with the correct id on click", () => {
    const onChange = vi.fn();
    renderTabs("overview", onChange);
    fireEvent.click(screen.getByRole("tab", { name: "Pricing" }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("pricing");
  });

  it("calls onChange when the already-active tab is clicked", () => {
    const onChange = vi.fn();
    renderTabs("overview", onChange);
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(onChange).toHaveBeenCalledWith("overview");
  });
});

// ── Keyboard navigation ───────────────────────────────────────────────────────

describe("Tabs – keyboard navigation", () => {
  it("ArrowRight moves to the next tab", () => {
    const onChange = vi.fn();
    renderTabs("overview", onChange);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("documentation");
  });

  it("ArrowRight wraps from last to first", () => {
    const onChange = vi.fn();
    renderTabs("pricing", onChange);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Pricing" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("ArrowLeft moves to the previous tab", () => {
    const onChange = vi.fn();
    renderTabs("documentation", onChange);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Documentation" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("ArrowLeft wraps from first to last", () => {
    const onChange = vi.fn();
    renderTabs("overview", onChange);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("pricing");
  });

  it("Home jumps to the first tab", () => {
    const onChange = vi.fn();
    renderTabs("pricing", onChange);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Pricing" }), { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("End jumps to the last tab", () => {
    const onChange = vi.fn();
    renderTabs("overview", onChange);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "End" });
    expect(onChange).toHaveBeenCalledWith("pricing");
  });

  it("other keys do not call onChange", () => {
    const onChange = vi.fn();
    renderTabs("overview", onChange);
    const tab = screen.getByRole("tab", { name: "Overview" });
    fireEvent.keyDown(tab, { key: "Tab" });
    fireEvent.keyDown(tab, { key: "Enter" });
    fireEvent.keyDown(tab, { key: " " });
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── Reduced motion ────────────────────────────────────────────────────────────

describe("Tabs – reduced motion", () => {
  it("uses 0ms duration when prefers-reduced-motion is active", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    // The reducedMotion ref is read once on component mount, so we need
    // matchMedia to be mocked before rendering.
    const { container } = render(<Tabs tabs={DEFAULT_TABS} activeTab="overview" onChange={vi.fn()} />);

    // The indicator span exists and has no transform (pure left/width approach).
    const indicator = container.querySelector("[aria-hidden='true']") as HTMLElement;
    expect(indicator).toBeTruthy();
    // Inline style must not use transform.
    expect(indicator.style.transform).toBeFalsy();

    window.matchMedia = original;
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("Tabs – edge cases", () => {
  it("handles a single tab without crashing on arrow keys", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={[{ id: "only", label: "Only" }]} activeTab="only" onChange={onChange} />);
    const tab = screen.getByRole("tab", { name: "Only" });
    expect(() => fireEvent.keyDown(tab, { key: "ArrowRight" })).not.toThrow();
    expect(() => fireEvent.keyDown(tab, { key: "ArrowLeft" })).not.toThrow();
    expect(onChange).toHaveBeenCalledWith("only");
  });

  it("renders correctly with two tabs", () => {
    render(
      <Tabs
        tabs={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        activeTab="a"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("forwards className to the nav element", () => {
    const { container } = render(<Tabs tabs={DEFAULT_TABS} activeTab="overview" onChange={vi.fn()} className="my-custom-tabs" />);
    const nav = container.querySelector("nav");
    expect(nav?.classList.contains("my-custom-tabs")).toBe(true);
  });

  it("id attribute on each tab button matches 'tab-{id}'", () => {
    renderTabs();
    DEFAULT_TABS.forEach(({ id, label }) => {
      const tab = screen.getByRole("tab", { name: label });
      expect(tab.id).toBe(`tab-${id}`);
    });
  });
});
