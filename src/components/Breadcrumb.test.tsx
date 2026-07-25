// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
