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
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");

    const popover = container.querySelector('[role="menu"]');
    const menuItems = Array.from(
      container.querySelectorAll('[role="menuitem"]'),
    );

    expect(popover).toBeTruthy();
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
});
