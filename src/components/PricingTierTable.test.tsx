// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PricingTierTable, { type PricingTier } from "./PricingTierTable";

afterEach(cleanup);

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
