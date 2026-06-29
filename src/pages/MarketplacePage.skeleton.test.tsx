// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarketplacePageSkeleton from "./MarketplacePage.skeleton";

describe("MarketplacePageSkeleton", () => {
  it("renders a busy route shell that mirrors the marketplace layout", () => {
    const { container, getByLabelText } = render(<MarketplacePageSkeleton />);

    expect(
      getByLabelText("Marketplace loading shell").getAttribute("aria-busy"),
    ).toBe("true");
    expect(container.querySelector(".marketplace-layout")).toBeTruthy();
    expect(container.querySelector(".marketplace-sidebar")).toBeTruthy();
    expect(container.querySelector(".marketplace-grid")).toBeTruthy();
    expect(container.querySelectorAll(".api-marketplace-card").length).toBe(6);
  });

  it("renders card skeletons that match the ApiCard structure for shape parity", () => {
    const { container } = render(<MarketplacePageSkeleton />);

    // Each card skeleton should contain the stats section matching the real card
    const cards = container.querySelectorAll(".api-marketplace-card");
    expect(cards.length).toBe(6);

    // Each card should have a stats section (matching real ApiCard structure)
    cards.forEach((card) => {
      expect(card.querySelector(".api-card__stats")).toBeTruthy();
      expect(card.querySelectorAll(".api-card__stat").length).toBe(3);
    });
  });

  it("renders header, filter sidebar, and toolbar placeholders", () => {
    const { container } = render(<MarketplacePageSkeleton />);

    expect(container.querySelector(".marketplace-header")).toBeTruthy();
    expect(container.querySelector(".marketplace-sidebar")).toBeTruthy();
    expect(container.querySelector(".marketplace-toolbar")).toBeTruthy();
    expect(container.querySelector(".filters-sidebar")).toBeTruthy();
  });
});
