// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Breadcrumb from "./Breadcrumb";

const longBreadcrumb = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Developer Tools", href: "/marketplace/developer-tools" },
  {
    label: "Very Long Machine Learning API Name",
    href: "/marketplace/developer-tools/ml-api",
  },
  {
    label: "Endpoint Documentation",
    href: "/marketplace/developer-tools/ml-api/docs",
    isCurrent: true,
  },
];

describe("Breadcrumb", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the first and current crumbs visible", () => {
    render(<Breadcrumb items={longBreadcrumb} />);

    expect(screen.getByRole("link", { name: "Marketplace" })).toBeTruthy();
    expect(screen.getByText("Endpoint Documentation").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("opens collapsed middle crumbs from the ellipsis button", () => {
    const { container } = render(<Breadcrumb items={longBreadcrumb} />);

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );

    if (!button) throw new Error("Expected breadcrumb ellipsis button");

    expect(button?.getAttribute("aria-label")).toBe(
      "Show collapsed breadcrumb items",
    );
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");

    const popover = container.querySelector('[role="menu"]');
    const menuItems = Array.from(
      container.querySelectorAll('[role="menuitem"]'),
    );

    expect(popover).toBeTruthy();
    expect(popover?.getAttribute("aria-label")).toBe(
      "Collapsed breadcrumb items",
    );
    expect(menuItems.map((item) => item.textContent)).toEqual([
      "Developer Tools",
      "Very Long Machine Learning API Name",
    ]);
  });

  it("closes the collapsed crumbs popover with Escape", () => {
    const { container } = render(<Breadcrumb items={longBreadcrumb} />);

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );

    if (!button) throw new Error("Expected breadcrumb ellipsis button");

    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("moves focus into collapsed crumbs and supports arrow key navigation", () => {
    const { container } = render(<Breadcrumb items={longBreadcrumb} />);

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );

    if (!button) throw new Error("Expected breadcrumb ellipsis button");

    fireEvent.click(button);

    const menu = container.querySelector<HTMLElement>('[role="menu"]');
    const menuItems = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    );

    if (!menu) throw new Error("Expected breadcrumb popover menu");

    expect(document.activeElement).toBe(menuItems[0]);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[1]);

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[0]);

    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(menuItems[1]);

    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(menuItems[0]);
  });

  it("wraps focus to the last collapsed crumb on ArrowUp", () => {
    const { container } = render(<Breadcrumb items={longBreadcrumb} />);

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );

    if (!button) throw new Error("Expected breadcrumb ellipsis button");

    fireEvent.click(button);

    const menu = container.querySelector<HTMLElement>('[role="menu"]');
    const menuItems = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    );

    if (!menu) throw new Error("Expected breadcrumb popover menu");

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(menuItems[1]);
  });

  it("returns focus to the ellipsis button when closing the popover with Escape", () => {
    const { container } = render(<Breadcrumb items={longBreadcrumb} />);

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );

    if (!button) throw new Error("Expected breadcrumb ellipsis button");

    fireEvent.click(button);
    const menu = container.querySelector<HTMLElement>('[role="menu"]');

    if (!menu) throw new Error("Expected breadcrumb popover menu");

    fireEvent.keyDown(menu, { key: "Escape" });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("applies the link-nav utility class to breadcrumb links", () => {
    render(<Breadcrumb items={longBreadcrumb} />);
    const link = screen.getByRole("link", { name: "Marketplace" });
    expect(link.classList.contains("link-nav")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Focused tests for #578 — Tooltip primitive wired to Breadcrumb icon buttons
// ---------------------------------------------------------------------------
describe("Breadcrumb — Tooltip on ellipsis button", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  /**
   * Render Breadcrumb and return the ellipsis button plus a
   * container-scoped queryTooltip helper. Using container.querySelector
   * instead of screen queries prevents cross-test contamination from
   * tooltips that are open at the end of a previous test.
   */
  function setup() {
    const { container } = render(<Breadcrumb items={longBreadcrumb} />);
    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected breadcrumb ellipsis button");

    /** Returns the live tooltip element scoped to this render, or null. */
    const queryTooltip = () =>
      container.querySelector<HTMLElement>('[role="tooltip"]');

    return { container, button, queryTooltip };
  }

  it("tooltip is hidden by default on the ellipsis button", () => {
    const { queryTooltip } = setup();
    expect(queryTooltip()).toBeNull();
  });

  it("tooltip appears on mouseenter after hover delay and hides on mouseleave", () => {
    vi.useFakeTimers();
    const { button, queryTooltip } = setup();

    fireEvent.mouseEnter(button);
    // Not visible yet — hoverDelayMs of 300 ms has not elapsed.
    expect(queryTooltip()).toBeNull();

    act(() => {
      vi.runAllTimers();
    });
    const tip = queryTooltip();
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toBe("Show hidden pages");

    fireEvent.mouseLeave(button);
    expect(queryTooltip()).toBeNull();
  });

  it("tooltip appears instantly on keyboard focus and hides on blur", () => {
    const { button, queryTooltip } = setup();

    fireEvent.focus(button);
    const tip = queryTooltip();
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toBe("Show hidden pages");

    fireEvent.blur(button);
    expect(queryTooltip()).toBeNull();
  });

  it("button gets aria-describedby pointing at the tooltip id when open", () => {
    const { button, queryTooltip } = setup();

    fireEvent.focus(button);
    const tip = queryTooltip();
    expect(tip).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBe(tip!.id);

    // Close to prevent tooltip state from leaking into the next test.
    fireEvent.blur(button);
  });

  it("aria-describedby is absent when the tooltip is closed", () => {
    const { button } = setup();
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("tooltip dismisses on Escape key", () => {
    vi.useFakeTimers();
    const { button, queryTooltip } = setup();

    fireEvent.mouseEnter(button);
    act(() => {
      vi.runAllTimers();
    });
    expect(queryTooltip()).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryTooltip()).toBeNull();
  });

  it("tooltip content is 'Show hidden pages'; button aria-label is 'Show collapsed breadcrumb items'", () => {
    const { button, queryTooltip } = setup();
    fireEvent.focus(button);
    const tip = queryTooltip();
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toBe("Show hidden pages");
    // The accessible label on the button is a separate concern and unchanged.
    expect(button.getAttribute("aria-label")).toBe(
      "Show collapsed breadcrumb items",
    );
    // Close to prevent tooltip state from leaking into the next test.
    fireEvent.blur(button);
  });

  it("long-press on touch triggers the tooltip after longPressMs", () => {
    vi.useFakeTimers();
    const { button, queryTooltip } = setup();

    fireEvent.touchStart(button);
    // Tooltip must not appear before the long-press threshold.
    expect(queryTooltip()).toBeNull();

    // Run all pending timers (longPressMs = 500 ms configured in Breadcrumb.tsx).
    act(() => {
      vi.runAllTimers();
    });
    expect(queryTooltip()).toBeTruthy();

    fireEvent.touchEnd(button);
  });

  it("releasing touch before longPressMs prevents the tooltip from showing", () => {
    vi.useFakeTimers();
    const { button, queryTooltip } = setup();

    fireEvent.touchStart(button);
    // Cancel before the threshold elapses.
    act(() => {
      vi.advanceTimersByTime(200); // < 500 ms
    });
    fireEvent.touchEnd(button); // clears the long-press timer

    // Even after advancing well past the threshold, tooltip stays hidden.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(queryTooltip()).toBeNull();
  });
});
