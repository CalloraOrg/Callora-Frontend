// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PricingTierTable, { type PricingTier } from "./PricingTierTable";

afterEach(cleanup);

/**
 * Forces `window.matchMedia("(max-width: 768px)")` to report a match so the
 * component renders its mobile card layout.
 */
function mockViewport(isMobile: boolean) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

const mockTiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for experimentation",
    features: [{ label: "Core access", included: true }],
    ctaLabel: "Get Started",
  },
  {
    name: "Pro",
    price: "$10",
    description: "Ideal for production",
    features: [{ label: "Core access", included: true }, { label: "Premium support", included: true }],
    ctaLabel: "Upgrade Now",
    isRecommended: true,
  },
];

describe("PricingTierTable", () => {
  it("renders pricing tiers and identifies recommended plan", () => {
    render(<PricingTierTable tiers={mockTiers} />);

    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("Recommended")).toBeTruthy();
  });

  it("renders shortcut hint chip (KbdHint) for the recommended plan's primary action", () => {
    render(<PricingTierTable tiers={mockTiers} />);

    // Should display KbdHint with shortcut S
    const kbd = screen.getByText("S");
    expect(kbd).toBeTruthy();
    expect(screen.getByText("Select recommended plan")).toBeTruthy();
  });

  it("triggers onSelectTier when clicking CTA button", () => {
    const onSelectTier = vi.fn();
    render(<PricingTierTable tiers={mockTiers} onSelectTier={onSelectTier} />);

    const ctaButtons = screen.getAllByRole("button");
    fireEvent.click(ctaButtons[0]); // Click Free CTA

    expect(onSelectTier).toHaveBeenCalledWith(mockTiers[0]);
  });

  it("triggers onSelectTier for recommended plan when pressing 's' key", () => {
    const onSelectTier = vi.fn();
    render(<PricingTierTable tiers={mockTiers} onSelectTier={onSelectTier} />);

    fireEvent.keyDown(window, { key: "s" });

    expect(onSelectTier).toHaveBeenCalledWith(mockTiers[1]);
  });

  it("does not trigger onSelectTier when pressing 's' key inside input fields", () => {
    const onSelectTier = vi.fn();
    render(
      <div>
        <input type="text" data-testid="test-input" />
        <PricingTierTable tiers={mockTiers} onSelectTier={onSelectTier} />
      </div>
    );

    const input = screen.getByTestId("test-input");
    input.focus();
    fireEvent.keyDown(input, { key: "s" });

    expect(onSelectTier).not.toHaveBeenCalled();
  });
});

// ─── Shortcut hint chip (issue #944) ─────────────────────────────────────────

describe("PricingTierTable — shortcut hint chip", () => {
  /** Returns the KbdHint chip element, or null when it is not rendered. */
  const getChip = (container: HTMLElement) =>
    container.querySelector(".kbd-hint--chip");

  it("renders the hint as the compact chip variant, not the default list", () => {
    const { container } = render(<PricingTierTable tiers={mockTiers} />);

    const chip = getChip(container);
    expect(chip).toBeTruthy();
    // The chip variant must not fall back to the right-aligned <aside> list.
    expect(chip?.tagName.toLowerCase()).toBe("span");
    expect(container.querySelector("aside.kbd-hint")).toBeNull();
  });

  it("wires the descriptive label through to KbdHint", () => {
    const { container } = render(<PricingTierTable tiers={mockTiers} />);

    // NOTE: this asserts the prop is wired, not that it is announced — the
    // chip container is a <span> (role=generic), where ARIA prohibits naming.
    // The information a screen reader actually receives is the visible text
    // below plus aria-keyshortcuts on the button.
    expect(getChip(container)?.getAttribute("aria-label")).toBe(
      "Keyboard shortcut to select the recommended plan"
    );
  });

  it("keeps the shortcut description as real visible text", () => {
    render(<PricingTierTable tiers={mockTiers} />);

    expect(screen.getByText("Select recommended plan")).toBeTruthy();
    // A real <kbd> element, not a styled span.
    expect(screen.getByText("S").tagName.toLowerCase()).toBe("kbd");
  });

  it("renders the chip only for the recommended tier", () => {
    const { container } = render(<PricingTierTable tiers={mockTiers} />);

    // Two tiers are rendered but only "Pro" is recommended.
    expect(container.querySelectorAll(".kbd-hint--chip")).toHaveLength(1);

    const recommendedCard = screen
      .getByText("Upgrade Now")
      .closest(".pricing-tier-card");
    expect(recommendedCard?.querySelector(".kbd-hint--chip")).toBeTruthy();
  });

  it("renders no chip when no tier is marked as recommended", () => {
    const tiersWithoutRecommendation = mockTiers.map((tier) => ({
      ...tier,
      isRecommended: false,
    }));
    const { container } = render(
      <PricingTierTable tiers={tiersWithoutRecommendation} />
    );

    expect(getChip(container)).toBeNull();
  });

  it("sets aria-keyshortcuts on the recommended tier's primary action only", () => {
    render(<PricingTierTable tiers={mockTiers} />);

    expect(screen.getByText("Upgrade Now").getAttribute("aria-keyshortcuts")).toBe("s");
    expect(screen.getByText("Get Started").getAttribute("aria-keyshortcuts")).toBeNull();
  });

  it("renders the chip in the mobile card layout as well", () => {
    const restore = mockViewport(true);
    try {
      const { container } = render(<PricingTierTable tiers={mockTiers} />);

      expect(container.querySelector(".pricing-tiers-mobile")).toBeTruthy();
      expect(getChip(container)).toBeTruthy();
      expect(screen.getByText("Select recommended plan")).toBeTruthy();
    } finally {
      restore();
    }
  });

  it("ignores modified 's' presses so browser combos like Ctrl+S still work", () => {
    const onSelectTier = vi.fn();
    render(<PricingTierTable tiers={mockTiers} onSelectTier={onSelectTier} />);

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    fireEvent.keyDown(window, { key: "s", altKey: true });

    expect(onSelectTier).not.toHaveBeenCalled();

    // Sanity check: the unmodified key still activates the shortcut.
    fireEvent.keyDown(window, { key: "s" });
    expect(onSelectTier).toHaveBeenCalledTimes(1);
  });

  it("accepts uppercase 'S' matching the key cap shown in the chip", () => {
    const onSelectTier = vi.fn();
    render(<PricingTierTable tiers={mockTiers} onSelectTier={onSelectTier} />);

    fireEvent.keyDown(window, { key: "S" });

    expect(onSelectTier).toHaveBeenCalledWith(mockTiers[1]);
  });

  it("removes its keydown listener on unmount", () => {
    const onSelectTier = vi.fn();
    const { unmount } = render(
      <PricingTierTable tiers={mockTiers} onSelectTier={onSelectTier} />
    );

    unmount();
    fireEvent.keyDown(window, { key: "s" });

    expect(onSelectTier).not.toHaveBeenCalled();
  });

  it("falls back to the tier name when the tier has no PlanBadge metadata", () => {
    // "developer" is not one of PlanBadge's supported tiers; the card must
    // still label itself rather than rendering a badge with no metadata.
    render(
      <PricingTierTable
        tiers={[{ ...mockTiers[1], tier: "developer" }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Pro" })).toBeTruthy();
  });
});
