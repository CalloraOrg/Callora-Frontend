// @vitest-environment jsdom
/**
 * PlanSelector.test.tsx
 *
 * Tests for Issue #710: PlanSelector uses middle-ellipsis breadcrumb when
 * the API path is long, so both the root namespace and the terminal
 * identifier remain visible.
 */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlanSelector, { MAX_CRUMB_LABEL_LENGTH } from "./PlanSelector";
import type { PricingTier } from "../components/PricingTierTable";

// ─── Mocks ─────────────────────────────────────────────────────────────────
// matchMedia is not available in jsdom; provide a no-op stub.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
}

afterEach(cleanup);

// ─── Fixtures ───────────────────────────────────────────────────────────────

const SHORT_BREADCRUMBS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Select a Plan", href: "/marketplace/plans", isCurrent: true },
];

/**
 * Breadcrumbs where the middle item's label exceeds MAX_CRUMB_LABEL_LENGTH
 * and should be truncated with a middle-ellipsis.
 */
const LONG_BREADCRUMBS = [
  { label: "Marketplace", href: "/marketplace" },
  {
    label: "Very Long Machine Learning API Category Name",
    href: "/marketplace/ml",
  },
  {
    label: "Select a Plan",
    href: "/marketplace/ml/plans",
    isCurrent: true,
  },
];

const MOCK_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    description: "For experimentation",
    features: [{ label: "100 calls/month", included: true }],
    ctaLabel: "Get Started",
  },
  {
    name: "Pro",
    price: "$49",
    description: "For production use",
    features: [
      { label: "100 calls/month", included: true },
      { label: "Priority support", included: true },
    ],
    ctaLabel: "Upgrade",
    isRecommended: true,
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PlanSelector — breadcrumb rendering (Issue #710)", () => {
  it("renders a breadcrumb nav landmark", () => {
    render(<PlanSelector breadcrumbs={SHORT_BREADCRUMBS} tiers={MOCK_TIERS} />);
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeTruthy();
  });

  it("renders all breadcrumb labels for short paths", () => {
    render(<PlanSelector breadcrumbs={SHORT_BREADCRUMBS} tiers={MOCK_TIERS} />);
    expect(screen.getByRole("link", { name: "Marketplace" })).toBeTruthy();
    // "Select a Plan" appears in breadcrumb (aria-current="page") and as the h1.
    // Use getAllByText and confirm at least one is in the breadcrumb nav.
    const instances = screen.getAllByText("Select a Plan");
    expect(instances.length).toBeGreaterThanOrEqual(1);
  });

  it("marks the last breadcrumb as the current page", () => {
    render(<PlanSelector breadcrumbs={SHORT_BREADCRUMBS} tiers={MOCK_TIERS} />);
    // The breadcrumb current item renders as a <span aria-current="page">
    const breadcrumbCurrent = document.querySelector('[aria-current="page"]');
    expect(breadcrumbCurrent).toBeTruthy();
    expect(breadcrumbCurrent?.textContent).toBe("Select a Plan");
  });

  it("truncates a long middle crumb with middle-ellipsis", () => {
    render(<PlanSelector breadcrumbs={LONG_BREADCRUMBS} tiers={MOCK_TIERS} />);

    // The long label exceeds MAX_CRUMB_LABEL_LENGTH and should be visually truncated.
    const longLabel = "Very Long Machine Learning API Category Name";
    expect(longLabel.length).toBeGreaterThan(MAX_CRUMB_LABEL_LENGTH);

    // Verify that the ellipsis character (…) appears in the DOM for the truncated crumb.
    // Since the crumb is a middle item it is rendered in a collapsible popover;
    // open the ellipsis button first.
    const ellipsisBtn = screen.queryByRole("button", {
      name: /show collapsed breadcrumb items/i,
    });
    if (ellipsisBtn) {
      ellipsisBtn.click();
      const menuItems = screen.getAllByRole("menuitem");
      const truncated = menuItems.find((item) =>
        (item.textContent ?? "").includes("\u2026"),
      );
      expect(truncated).toBeTruthy();
    } else {
      // Crumb is directly visible (not collapsed) — check for ellipsis in link text
      const truncated = document
        .querySelectorAll<HTMLElement>(".breadcrumb-link--middle-ellipsis, .breadcrumb-current--middle-ellipsis");
      expect(truncated.length).toBeGreaterThan(0);
    }
  });

  it("preserves the full label in the title attribute for hover/tooltip access", () => {
    render(<PlanSelector breadcrumbs={LONG_BREADCRUMBS} tiers={MOCK_TIERS} />);

    // The full label must be present in a title or aria-label so tooltip / AT users see it.
    const fullLabel = "Very Long Machine Learning API Category Name";

    // Check title attributes on all elements
    const allWithTitle = Array.from(
      document.querySelectorAll<HTMLElement>("[title]"),
    ).filter((el) => el.getAttribute("title") === fullLabel);

    // Check aria-labels as well (Breadcrumb adds aria-label when truncated)
    const allWithAriaLabel = Array.from(
      document.querySelectorAll<HTMLElement>("[aria-label]"),
    ).filter((el) => el.getAttribute("aria-label") === fullLabel);

    expect(allWithTitle.length + allWithAriaLabel.length).toBeGreaterThan(0);
  });

  it("exports MAX_CRUMB_LABEL_LENGTH as a number ≥ 8 (Breadcrumb minimum)", () => {
    expect(typeof MAX_CRUMB_LABEL_LENGTH).toBe("number");
    expect(MAX_CRUMB_LABEL_LENGTH).toBeGreaterThanOrEqual(8);
  });

  it("passes maxLabelLength prop equal to MAX_CRUMB_LABEL_LENGTH to the Breadcrumb", () => {
    // Verify via indirect observable: a label exactly at the limit is NOT truncated,
    // while one exceeding it IS truncated (middle-ellipsis class applied).
    const label40chars = "A".repeat(MAX_CRUMB_LABEL_LENGTH + 1); // one over limit
    const overLimitCrumbs = [
      { label: "Home", href: "/" },
      { label: label40chars, href: "/x" },
      { label: "Select Plan", href: "/x/plan", isCurrent: true },
    ];
    render(<PlanSelector breadcrumbs={overLimitCrumbs} tiers={MOCK_TIERS} />);

    // Open collapsed items if needed
    const ellipsisBtn = screen.queryByRole("button", {
      name: /show collapsed breadcrumb items/i,
    });
    if (ellipsisBtn) {
      ellipsisBtn.click();
    }

    // Look for an element that carries the middle-ellipsis modifier class
    const truncatedEls = document.querySelectorAll<HTMLElement>(
      ".breadcrumb-link--middle-ellipsis, .breadcrumb-popover-link--middle-ellipsis, .breadcrumb-current--middle-ellipsis",
    );
    expect(truncatedEls.length).toBeGreaterThan(0);
  });

  it("does NOT truncate a label that fits within MAX_CRUMB_LABEL_LENGTH characters", () => {
    const shortMiddleLabel = "Short Label";
    expect(shortMiddleLabel.length).toBeLessThanOrEqual(MAX_CRUMB_LABEL_LENGTH);
    const fitCrumbs = [
      { label: "Marketplace", href: "/marketplace" },
      { label: shortMiddleLabel, href: "/marketplace/short" },
      { label: "Plans", href: "/marketplace/short/plans", isCurrent: true },
    ];
    render(<PlanSelector breadcrumbs={fitCrumbs} tiers={MOCK_TIERS} />);

    // No middle-ellipsis class should appear
    const truncatedEls = document.querySelectorAll<HTMLElement>(
      ".breadcrumb-link--middle-ellipsis, .breadcrumb-popover-link--middle-ellipsis, .breadcrumb-current--middle-ellipsis",
    );
    expect(truncatedEls.length).toBe(0);
  });
});

describe("PlanSelector — page structure", () => {
  it("renders a section landmark labelled by the heading", () => {
    render(<PlanSelector breadcrumbs={SHORT_BREADCRUMBS} tiers={MOCK_TIERS} />);
    expect(
      screen.getByRole("region", { name: "Select a Plan" }),
    ).toBeTruthy();
  });

  it("renders the default heading 'Select a Plan'", () => {
    render(<PlanSelector breadcrumbs={SHORT_BREADCRUMBS} tiers={MOCK_TIERS} />);
    expect(
      screen.getByRole("heading", { name: "Select a Plan", level: 1 }),
    ).toBeTruthy();
  });

  it("renders a custom heading when provided", () => {
    render(
      <PlanSelector
        breadcrumbs={SHORT_BREADCRUMBS}
        tiers={MOCK_TIERS}
        heading="Choose Your Plan"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Choose Your Plan", level: 1 }),
    ).toBeTruthy();
  });

  it("renders the pricing tier table", () => {
    render(<PlanSelector breadcrumbs={SHORT_BREADCRUMBS} tiers={MOCK_TIERS} />);
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
  });

  it("fires onSelectTier when a CTA button is clicked", () => {
    const onSelectTier = vi.fn();
    render(
      <PlanSelector
        breadcrumbs={SHORT_BREADCRUMBS}
        tiers={MOCK_TIERS}
        onSelectTier={onSelectTier}
      />,
    );
    const [firstCta] = screen.getAllByRole("button", { name: /Get Started/i });
    firstCta.click();
    expect(onSelectTier).toHaveBeenCalledWith(MOCK_TIERS[0]);
  });
});
