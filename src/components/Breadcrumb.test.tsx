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

// ─── truncateMiddle unit tests ────────────────────────────────────────────────

describe("truncateMiddle", () => {
  it("returns the original string when it is within the limit", () => {
    expect(truncateMiddle("short", 24)).toBe("short");
    expect(truncateMiddle("exactly24characters!!!!!!", 26)).toBe(
      "exactly24characters!!!!!!",
    );
  });

  it("returns the original string when length equals maxLen exactly", () => {
    const str = "a".repeat(24);
    expect(truncateMiddle(str, 24)).toBe(str);
  });

  it("truncates strings longer than maxLen with a middle ellipsis", () => {
    // "VeryLongMachineLearningAPIName" (30 chars) with maxLen=24:
    //   budget = 24 - 1 = 23
    //   endLen = floor(23 / 2) = 11  → last 11 chars = "ningAPIName"
    //   startLen = 23 - 11 = 12     → first 12 chars = "VeryLongMach"
    //   result = "VeryLongMach…ningAPIName"  (24 chars total)
    const result = truncateMiddle("VeryLongMachineLearningAPIName", 24);
    expect(result).toContain("…");
    expect(result.length).toBe(24);
    expect(result.endsWith("Name")).toBe(true);
    expect(result.startsWith("VeryLongMach")).toBe(true);
  });

  it("favours the start in the budget split (start gets extra char on odd budget)", () => {
    // maxLen=5: budget=4, endLen=2, startLen=2 → 2+1+2=5 chars
    // "Hello World" → start="He", end="ld" → "He…ld"
    expect(truncateMiddle("Hello World", 5)).toBe("He\u2026ld");
  });

  it("works with maxLen=4 (minimum)", () => {
    const result = truncateMiddle("abcdefghij", 4);
    // budget=3, endLen=1, startLen=2 → "ab…j"
    expect(result).toBe("ab\u2026j");
    expect(result.length).toBe(4);
  });

  it("returns the string unchanged for maxLen < 4", () => {
    expect(truncateMiddle("abcdefghij", 3)).toBe("abcdefghij");
    expect(truncateMiddle("abcdefghij", 0)).toBe("abcdefghij");
  });

  it("handles empty string", () => {
    expect(truncateMiddle("", 24)).toBe("");
  });

  it("handles string equal to exactly one character over the limit", () => {
    const str = "a".repeat(25);
    const result = truncateMiddle(str, 24);
    expect(result).toContain("…");
    expect(result.length).toBe(24);
  });

  it("uses the Unicode ellipsis character (U+2026), not three dots", () => {
    const result = truncateMiddle("VeryLongStringHereToTest", 10);
    expect(result).toContain("\u2026");
    expect(result).not.toContain("...");
  });
});

// ─── Breadcrumb middleEllipsis prop ──────────────────────────────────────────

describe("Breadcrumb – middleEllipsis prop", () => {
  afterEach(() => {
    cleanup();
  });

  const longLabel = "Advanced Language Model Completions API v2";
  // With maxLen=20: budget=19, endLen=9, startLen=10 → "Advanced L…ions API v2"
  const items = [
    { label: "Marketplace", href: "/marketplace" },
    { label: longLabel, href: "/marketplace/api", isCurrent: true },
  ];

  it("does NOT truncate labels when middleEllipsis is false (default)", () => {
    render(<Breadcrumb items={items} />);
    // The current crumb should show the full label text
    const current = screen.getByText(longLabel);
    expect(current).toBeTruthy();
    expect(current.getAttribute("data-truncated")).toBeNull();
  });

  it("truncates long labels when middleEllipsis is true", () => {
    render(<Breadcrumb items={items} middleEllipsis middleEllipsisMaxLen={20} />);
    // The visible text should be shortened (contains ellipsis character)
    const current = document.querySelector("[aria-current='page']");
    expect(current).toBeTruthy();
    expect(current!.textContent).toContain("…");
    expect(current!.textContent!.length).toBeLessThan(longLabel.length);
  });

  it("sets data-truncated='true' on truncated crumbs", () => {
    render(<Breadcrumb items={items} middleEllipsis middleEllipsisMaxLen={20} />);
    const current = document.querySelector("[aria-current='page']");
    expect(current?.getAttribute("data-truncated")).toBe("true");
  });

  it("preserves the full label in aria-label for accessibility", () => {
    render(<Breadcrumb items={items} middleEllipsis middleEllipsisMaxLen={20} />);
    const current = document.querySelector("[aria-current='page']");
    // aria-label must contain the complete original label
    expect(current?.getAttribute("aria-label")).toBe(longLabel);
  });

  it("preserves the full label in the title attribute", () => {
    render(<Breadcrumb items={items} middleEllipsis middleEllipsisMaxLen={20} />);
    const current = document.querySelector("[aria-current='page']");
    expect(current?.getAttribute("title")).toBe(longLabel);
  });

  it("does NOT set data-truncated on a short label that fits within maxLen", () => {
    const shortItems = [
      { label: "Marketplace", href: "/marketplace" },
      { label: "Short API", href: "/marketplace/short", isCurrent: true },
    ];
    render(<Breadcrumb items={shortItems} middleEllipsis middleEllipsisMaxLen={20} />);
    const current = document.querySelector("[aria-current='page']");
    expect(current?.getAttribute("data-truncated")).toBeNull();
    expect(current?.textContent).toBe("Short API");
  });

  it("applies the middle-ellipsis CSS modifier class to truncated links", () => {
    const linkItems = [
      { label: longLabel, href: "/marketplace" },
      { label: "Current Page", href: "/marketplace/current", isCurrent: true },
    ];
    render(
      <Breadcrumb items={linkItems} middleEllipsis middleEllipsisMaxLen={20} />,
    );
    const link = document.querySelector(".breadcrumb-link--middle-ellipsis");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("data-truncated")).toBe("true");
  });

  it("applies the middle-ellipsis CSS modifier class to truncated current crumbs", () => {
    render(<Breadcrumb items={items} middleEllipsis middleEllipsisMaxLen={20} />);
    const current = document.querySelector(
      ".breadcrumb-current--middle-ellipsis",
    );
    expect(current).toBeTruthy();
  });

  it("keeps full labels in the popover even when middleEllipsis is active", () => {
    // Middle item should show full label inside the popover, not truncated.
    const deepItems = [
      { label: "Marketplace", href: "/marketplace" },
      {
        label: "Advanced Language Model Completions And More API",
        href: "/marketplace/alm",
      },
      {
        label: "Current Page",
        href: "/marketplace/alm/current",
        isCurrent: true,
      },
    ];
    const { container } = render(
      <Breadcrumb items={deepItems} middleEllipsis middleEllipsisMaxLen={20} />,
    );
    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected breadcrumb ellipsis button");

    fireEvent.click(button);

    const menuItems = Array.from(
      container.querySelectorAll('[role="menuitem"]'),
    );
    // The popover shows the full label, not a truncated version
    expect(menuItems[0].textContent).toBe(
      "Advanced Language Model Completions And More API",
    );
  });

  it("uses custom middleEllipsisMaxLen when provided", () => {
    render(<Breadcrumb items={items} middleEllipsis middleEllipsisMaxLen={10} />);
    const current = document.querySelector("[aria-current='page']");
    // With maxLen=10 the result should be at most 10 chars
    expect(current!.textContent!.length).toBeLessThanOrEqual(10);
    expect(current!.textContent).toContain("…");
  });
});
