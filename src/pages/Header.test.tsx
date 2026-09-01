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

  // ── Overflow / flex-shrink polish tests ─────────────────────────────────
  //
  // These tests validate structural and CSS-level overflow protection in the
  // jsdom test environment.  Because jsdom does not compute layout, we verify
  // the presence and values of the CSS properties that control flex shrinking
  // and content overflow, rather than measuring actual bounding boxes.

  it("contains the breadcrumb inside .topbar-actions", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
    );

    const topbarActions = container.querySelector(".topbar-actions");
    if (!topbarActions) throw new Error("Expected .topbar-actions");

    const nav = topbarActions.querySelector('[aria-label="breadcrumb"]');
    expect(nav).not.toBeNull();
  });

  it("allows the breadcrumb nav to shrink within its flex container", () => {
    const { container } = render(
      <Header breadcrumbItems={SAMPLE_ITEMS} />,
    );

    const nav = container.querySelector('[aria-label="breadcrumb"]');
    if (!nav) throw new Error("Expected breadcrumb nav");

    // jsdom returns "0" (no px suffix) for computed min-width: 0
    const navStyle = window.getComputedStyle(nav);
    expect(navStyle.minWidth).toBe("0");
    expect(navStyle.maxWidth).toBe("100%");
  });

  it("renders the middle-ellipsis collapsed layout with a very long path", () => {
    const veryLongItems: BreadcrumbItem[] = [
      {
        label: "A Very Long Root Segment Name That Keeps Going",
        href: "/very-long-root-segment",
      },
      {
        label: "Intermediate Level With An Extremely Long Middle Segment Path",
        href: "/very-long-root-segment/intermediate",
      },
      {
        label: "Another Middle Crumb With Even More Characters In The Label",
        href: "/very-long-root-segment/intermediate/another",
      },
      {
        label: "Final Destination Current Page Label That Is Also Quite Extended",
        href: "/very-long-root-segment/intermediate/another/final",
        isCurrent: true,
      },
    ];

    const { container } = render(
      <Header breadcrumbItems={veryLongItems} />,
    );

    // The breadcrumb nav should have the middle-ellipsis modifier class
    const nav = container.querySelector('[aria-label="breadcrumb"]');
    expect(nav?.className).toContain("breadcrumb-nav--middle-ellipsis");

    // The first crumb link and last (current) crumb are visible
    const firstLink = screen.getByRole("link", {
      name: veryLongItems[0].label,
    });
    expect(firstLink).not.toBeNull();
    expect(firstLink.classList.contains("link-nav")).toBe(true);

    // Current page item is visible with aria-current="page"
    const current = screen.getByText(veryLongItems[3].label);
    expect(current.getAttribute("aria-current")).toBe("page");

    // Middle items are hidden (via CSS display:none)
    const middleItems = container.querySelectorAll(".breadcrumb-middle");
    expect(middleItems.length).toBe(2);
    for (const item of middleItems) {
      expect(window.getComputedStyle(item).display).toBe("none");
    }

    // Ellipsis button is rendered for collapsed middle items
    const ellipsis = container.querySelector(".breadcrumb-ellipsis");
    expect(ellipsis).not.toBeNull();
  });
});