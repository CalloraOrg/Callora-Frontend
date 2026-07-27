// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
});