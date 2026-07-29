// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Header from "./Header";
import type { BreadcrumbItem } from "../components/Breadcrumb";

const SAMPLE_ITEMS: BreadcrumbItem[] = [
  { label: "Home", href: "/" },
  { label: "Marketplace", href: "/marketplace" },
  {
    label: "GrantFox Wave Compute API – Stellar Edition",
    href: "/marketplace/grantfox-wave-compute",
  },
  {
    label: "Rate Limits & Throttling Policies",
    href: "/marketplace/grantfox-wave-compute/rate-limits",
  },
  {
    label: "Current Plan Configuration",
    href: "/marketplace/grantfox-wave-compute/rate-limits/config",
    isCurrent: true,
  },
];

afterEach(() => {
  cleanup();
});

describe("Header – GrantFox FWC26", () => {
  it("renders the topbar banner with role=banner", () => {
    render(<Header breadcrumbItems={SAMPLE_ITEMS} />);
    const banner = screen.getByRole("banner");
    expect(banner).not.toBeNull();
  });

  it("renders the Callora brand text", () => {
    render(<Header breadcrumbItems={SAMPLE_ITEMS} />);
    expect(screen.getByText("Callora Vault")).toBeTruthy();
    expect(
      screen.getByText("Secure USDC funding for premium API usage"),
    ).toBeTruthy();
  });

  it("renders a Breadcrumb with middleEllipsis enabled", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
    );

    const nav = container.querySelector('[aria-label="breadcrumb"]');
    expect(nav).not.toBeNull();
    expect(nav?.className).toContain("breadcrumb-nav--middle-ellipsis");
  });

  it("shows the first breadcrumb link and hides middle items", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
    );

    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();

    const middleItems = container.querySelectorAll(".breadcrumb-middle");
    for (const item of middleItems) {
      expect(window.getComputedStyle(item).display).toBe("none");
    }
  });

  it("shows the ellipsis button that opens the popover", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("...");

    fireEvent.click(button!);
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
  });

  it("shows the last (current) breadcrumb item", () => {
    render(<Header breadcrumbItems={SAMPLE_ITEMS} />);

    const current = screen.getByText("Current Plan Configuration");
    expect(current).not.toBeNull();
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("uses design tokens for color consistency", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
    );

    const links = container.querySelectorAll<HTMLAnchorElement>(
      ".breadcrumb-link",
    );
    for (const link of links) {
      const color = window.getComputedStyle(link).color;
      expect(color).not.toBe("");
    }
  });

  it("is keyboard accessible: Escape closes the popover", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
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

  it("returns focus to the trigger button when popover closes", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
    );

    const button = container.querySelector<HTMLButtonElement>(
      ".breadcrumb-ellipsis",
    );
    if (!button) throw new Error("Expected ellipsis button");

    fireEvent.click(button);

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(document.activeElement).toBe(button);
  });
});