// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Breadcrumb, { truncateMiddle } from "./Breadcrumb";

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

// ── truncateMiddle unit tests ─────────────────────────────────────────────────

describe("truncateMiddle", () => {
  it("returns the string unchanged when max is 0 (feature disabled)", () => {
    expect(truncateMiddle("Hello World", 0)).toBe("Hello World");
  });

  it("returns the string unchanged when max < 8 (not enough budget)", () => {
    expect(truncateMiddle("Hello World", 7)).toBe("Hello World");
    expect(truncateMiddle("Hello World", 1)).toBe("Hello World");
  });

  it("returns the string unchanged when it already fits", () => {
    expect(truncateMiddle("Short", 10)).toBe("Short");
    expect(truncateMiddle("Exactly10!", 10)).toBe("Exactly10!");
  });

  it("truncates long strings to exactly `max` characters (including the ellipsis)", () => {
    const result = truncateMiddle("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10);
    // budget = 9 chars of content, endLen = 4, startLen = 5
    // → "ABCDE…WXYZ" = 10 chars
    expect([...result].length).toBe(10);
    expect(result).toBe("ABCDE\u2026WXYZ");
  });

  it("uses a real Unicode ellipsis character (U+2026), not three full stops", () => {
    const result = truncateMiddle("A very long label that must be shortened", 12);
    expect(result).toContain("\u2026");
    expect(result).not.toContain("...");
  });

  it("preserves the start and end of the label", () => {
    const label = "GrantFox Wave Compute API – Stellar Edition";
    const result = truncateMiddle(label, 28);
    // label.length = 43 (includes em-dash), budget=27, endLen=13, startLen=14
    // start → "GrantFox Wave " (14 chars), end → "ellar Edition" (13 chars)
    expect(result.startsWith("GrantFox Wave ")).toBe(true);
    expect(result.endsWith("ellar Edition")).toBe(true);
    expect([...result].length).toBe(28);
  });

  it("handles odd budget by giving one extra character to the start", () => {
    // label = "0123456789ABCDEF" (16 chars), max=10
    // budget = 9, endLen = floor(9/2) = 4, startLen = 5
    // start → label.slice(0, 5)  = "01234"
    // end   → label.slice(16-4)  = "CDEF"   ← last 4 chars of the string
    const result = truncateMiddle("0123456789ABCDEF", 10);
    expect(result).toBe("01234\u2026CDEF");
    expect([...result].length).toBe(10);
  });
});

// ── Breadcrumb middle-ellipsis integration tests ──────────────────────────────

const LONG_LABEL_1 = "GrantFox Wave Compute API – Stellar Edition";
const LONG_LABEL_2 = "Rate Limits & Throttling Policies";

const truncatedBreadcrumb = [
  { label: "Marketplace", href: "/marketplace" },
  { label: LONG_LABEL_1, href: "/marketplace/grantfox" },
  { label: LONG_LABEL_2, href: "/marketplace/grantfox/rate-limits" },
  {
    label: "Current Plan Configuration",
    href: "/marketplace/grantfox/rate-limits/config",
    isCurrent: true,
  },
];

describe("Breadcrumb – middle-ellipsis (maxLabelLength)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders full labels when maxLabelLength is omitted (default 0)", () => {
    render(<Breadcrumb items={truncatedBreadcrumb} />);
    // All middle crumbs are hidden on desktop (breadcrumb-middle) but still in DOM
    const links = screen.getAllByRole("link");
    const allText = links.map((l) => l.textContent);
    // Marketplace is the first crumb link; rest are hidden/middle
    expect(allText).toContain("Marketplace");
  });

  it("truncates long middle-item labels with a middle-ellipsis", () => {
    const { container } = render(
      <Breadcrumb items={truncatedBreadcrumb} maxLabelLength={28} />,
    );

    // Open the popover to expose middle items in the DOM
    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");
    fireEvent.click(button);

    const menuItems = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    );

    // Both middle labels should be truncated (shorter than originals and contain …)
    for (const menuItem of menuItems) {
      const text = menuItem.textContent ?? "";
      expect(text).toContain("\u2026");
      expect([...text].length).toBe(28);
    }
  });

  it("preserves full labels in title and aria-label on truncated popover items", () => {
    const { container } = render(
      <Breadcrumb items={truncatedBreadcrumb} maxLabelLength={28} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");
    fireEvent.click(button);

    const menuItems = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    );

    expect(menuItems[0].getAttribute("title")).toBe(LONG_LABEL_1);
    expect(menuItems[0].getAttribute("aria-label")).toBe(LONG_LABEL_1);
    expect(menuItems[1].getAttribute("title")).toBe(LONG_LABEL_2);
    expect(menuItems[1].getAttribute("aria-label")).toBe(LONG_LABEL_2);
  });

  it("does NOT add aria-label when the label fits without truncation", () => {
    const shortItems = [
      { label: "Home", href: "/" },
      { label: "Settings", href: "/settings" },
      { label: "Profile", href: "/settings/profile", isCurrent: true },
    ];
    const { container } = render(
      <Breadcrumb items={shortItems} maxLabelLength={28} />,
    );
    // First item is a link and its label is short — should have no aria-label override
    const homeLink = container.querySelector<HTMLAnchorElement>(
      ".breadcrumb-link",
    );
    expect(homeLink).not.toBeNull();
    expect(homeLink?.getAttribute("aria-label")).toBeNull();
  });

  it("truncates the current-page crumb label when it is too long", () => {
    const items = [
      { label: "Marketplace", href: "/marketplace" },
      {
        label: "A Very Long Current Page Title Indeed",
        href: "/current",
        isCurrent: true,
      },
    ];
    render(<Breadcrumb items={items} maxLabelLength={20} />);

    // The current crumb is a <span> with aria-current="page"
    const current = document.querySelector<HTMLSpanElement>(
      '[aria-current="page"]',
    );
    expect(current).not.toBeNull();
    // Visual text should be truncated
    expect(current?.textContent).toContain("\u2026");
    expect([...(current?.textContent ?? "")].length).toBe(20);
    // Full text preserved in title and aria-label
    expect(current?.getAttribute("title")).toBe(
      "A Very Long Current Page Title Indeed",
    );
    expect(current?.getAttribute("aria-label")).toBe(
      "A Very Long Current Page Title Indeed",
    );
  });

  it("short labels remain unchanged when maxLabelLength is set", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Short", href: "/short", isCurrent: true },
    ];
    render(<Breadcrumb items={items} maxLabelLength={28} />);

    const current = document.querySelector<HTMLSpanElement>(
      '[aria-current="page"]',
    );
    expect(current?.textContent).toBe("Short");
    // No aria-label override needed
    expect(current?.getAttribute("aria-label")).toBeNull();
  });

  // ── #750 — modifier class prevents double-truncation on narrow containers ──
  //
  // The stylesheet defines `--middle-ellipsis` modifier classes specifically
  // to disable the CSS-level `text-overflow: ellipsis` once JS has already
  // shortened a label — without them, a JS-truncated string that still
  // doesn't fit its container (e.g. a very narrow viewport) gets ellipsized
  // a second time by CSS, producing a "start…en…" artefact. These tests
  // confirm the modifier is actually wired to the elements it was designed
  // for, not just present as unused CSS.

  it("applies the middle-ellipsis modifier class to a truncated first-crumb link", () => {
    const items = [
      { label: "A Very Long Root Segment Name", href: "/root" },
      { label: "Short", href: "/root/short", isCurrent: true },
    ];
    render(<Breadcrumb items={items} maxLabelLength={16} />);

    const link = screen.getByRole("link", {
      name: "A Very Long Root Segment Name",
    });
    expect(link.classList.contains("breadcrumb-link--middle-ellipsis")).toBe(
      true,
    );
  });

  it("does not apply the middle-ellipsis modifier class when the link label is not truncated", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Short", href: "/short", isCurrent: true },
    ];
    render(<Breadcrumb items={items} maxLabelLength={28} />);

    const link = screen.getByRole("link", { name: "Home" });
    expect(link.classList.contains("breadcrumb-link--middle-ellipsis")).toBe(
      false,
    );
  });

  it("applies the middle-ellipsis modifier class to a truncated current-page crumb", () => {
    const items = [
      { label: "Marketplace", href: "/marketplace" },
      {
        label: "A Very Long Current Page Title Indeed",
        href: "/current",
        isCurrent: true,
      },
    ];
    render(<Breadcrumb items={items} maxLabelLength={20} />);

    const current = document.querySelector<HTMLSpanElement>(
      '[aria-current="page"]',
    );
    expect(
      current?.classList.contains("breadcrumb-current--middle-ellipsis"),
    ).toBe(true);
  });

  it("does not apply the middle-ellipsis modifier class to a current-page crumb that fits", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Short", href: "/short", isCurrent: true },
    ];
    render(<Breadcrumb items={items} maxLabelLength={28} />);

    const current = document.querySelector<HTMLSpanElement>(
      '[aria-current="page"]',
    );
    expect(
      current?.classList.contains("breadcrumb-current--middle-ellipsis"),
    ).toBe(false);
  });

  it("applies the middle-ellipsis modifier class to truncated popover links", () => {
    const { container } = render(
      <Breadcrumb items={truncatedBreadcrumb} maxLabelLength={28} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");
    fireEvent.click(button);

    const menuItems = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    );

    expect(menuItems.length).toBeGreaterThan(0);
    for (const menuItem of menuItems) {
      expect(
        menuItem.classList.contains(
          "breadcrumb-popover-link--middle-ellipsis",
        ),
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Breadcrumb – middleEllipsis (collapses middle items on all viewports)
// ---------------------------------------------------------------------------
const ELLIPSIS_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Very Long First Middle Segment Name", href: "/home/middleware" },
  { label: "Another Extended Segment", href: "/home/middleware/data" },
  { label: "Target Page", href: "/home/middleware/data/target", isCurrent: true },
];

describe("Breadcrumb – middleEllipsis", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not hide middle items when middleEllipsis is false (default)", () => {
    const { container } = render(<Breadcrumb items={ELLIPSIS_ITEMS} />);

    const middleItems = container.querySelectorAll(".breadcrumb-middle");
    expect(middleItems.length).toBe(2);
    for (const item of middleItems) {
      expect(item).not.toHaveStyle("display: none");
    }
  });

  it("hides middle items when middleEllipsis is true", () => {
    const { container } = render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    const nav = container.querySelector(".breadcrumb-nav--middle-ellipsis");
    expect(nav).not.toBeNull();

    const middleItems = nav?.querySelectorAll(".breadcrumb-middle");
    expect(middleItems?.length).toBe(2);
    for (const item of middleItems ?? []) {
      expect(window.getComputedStyle(item).display).toBe("none");
    }
  });

  it("renders the ellipsis button inside the first item when middleEllipsis is true", () => {
    const { container } = render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("...");
    expect(button?.getAttribute("aria-label")).toBe(
      "Show collapsed breadcrumb items",
    );
    expect(button?.getAttribute("aria-haspopup")).toBe("menu");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the popover when the ellipsis button is clicked with middleEllipsis", () => {
    const { container } = render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    const popover = container.querySelector('[role="menu"]');
    expect(popover).not.toBeNull();
  });

  it("shows all middle items in the popover when opened with middleEllipsis", () => {
    const { container } = render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");
    fireEvent.click(button);

    const menuItems = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    );
    expect(menuItems.length).toBe(2);
    expect(menuItems[0].textContent).toBe(
      "Very Long First Middle Segment Name",
    );
    expect(menuItems[1].textContent).toBe("Another Extended Segment");
  });

  it("closes the popover with Escape when middleEllipsis is active", () => {
    const { container } = render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not render the ellipsis button or modifier class when there are no middle items (even with middleEllipsis)", () => {
    const shortItems = [
      { label: "Home", href: "/" },
      { label: "Settings", href: "/settings", isCurrent: true },
    ];
    const { container } = render(
      <Breadcrumb items={shortItems} middleEllipsis={true} />,
    );

    expect(container.querySelector(".breadcrumb-ellipsis")).toBeNull();
    expect(container.querySelector(".breadcrumb-nav--middle-ellipsis")).toBeNull();
  });

  it("shows the first crumb link and the current page with middleEllipsis active", () => {
    render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
    expect(
      screen.getByText("Target Page").getAttribute("aria-current"),
    ).toBe("page");
  });

  it("collapses middle items on desktop viewport when middleEllipsis is true", () => {
    const { container } = render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    const nav = container.querySelector<HTMLElement>(
      ".breadcrumb-nav--middle-ellipsis",
    );
    expect(nav).not.toBeNull();

    const middleItems = nav?.querySelectorAll(".breadcrumb-middle");
    expect(middleItems?.length).toBe(2);
    for (const item of middleItems ?? []) {
      expect(window.getComputedStyle(item).display).toBe("none");
    }

    const collapsed = nav?.querySelector(".breadcrumb-collapsed");
    expect(collapsed).not.toBeNull();
    expect(window.getComputedStyle(collapsed!).display).toBe("flex");
  });

  it("maintains keyboard navigation within the popover when middleEllipsis is active", () => {
    const { container } = render(
      <Breadcrumb items={ELLIPSIS_ITEMS} middleEllipsis={true} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");
    fireEvent.click(button);

    const menuItems = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    );
    expect(menuItems.length).toBe(2);

    expect(document.activeElement).toBe(menuItems[0]);

    fireEvent.keyDown(menuItems[0].parentElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems[1]);

    fireEvent.keyDown(menuItems[1].parentElement!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(menuItems[0]);

    fireEvent.keyDown(menuItems[0].parentElement!, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
describe("Breadcrumb — Tooltip on ellipsis button", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  function setup() {
    const { container } = render(<Breadcrumb items={longBreadcrumb} />);
    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected breadcrumb ellipsis button");

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
    expect(button.getAttribute("aria-label")).toBe(
      "Show collapsed breadcrumb items",
    );
    fireEvent.blur(button);
  });

  it("long-press on touch triggers the tooltip after longPressMs", () => {
    vi.useFakeTimers();
    const { button, queryTooltip } = setup();

    fireEvent.touchStart(button);
    expect(queryTooltip()).toBeNull();

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
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.touchEnd(button);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(queryTooltip()).toBeNull();
  });
});