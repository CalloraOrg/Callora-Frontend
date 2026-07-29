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
    expect(container.querySelector(".marketplace-page")).toBeTruthy();
    expect(container.querySelector(".marketplace-header")).toBeTruthy();
    expect(container.querySelector(".recently-active-rail-skeleton")).toBeTruthy();
    expect(container.querySelector(".marketplace-layout")).toBeTruthy();
    expect(container.querySelector(".marketplace-sidebar")).toBeTruthy();
    expect(container.querySelector(".marketplace-toolbar")).toBeTruthy();
    expect(container.querySelector(".filters-sidebar")).toBeTruthy();
    expect(container.querySelector(".pill-bar")).toBeTruthy();
    expect(container.querySelector(".api-tag-filter")).toBeTruthy();
    expect(container.querySelector(".marketplace-grid")).toBeTruthy();
    expect(container.querySelectorAll(".api-marketplace-card").length).toBe(12);
  });

  it("renders card skeletons that match the ApiCard structure for shape parity", () => {
    const { container } = render(<MarketplacePageSkeleton />);

    const cards = container.querySelectorAll(".api-marketplace-card");
    expect(cards.length).toBe(12);

    cards.forEach((card) => {
      expect(card.querySelector(".api-card__stats")).toBeTruthy();
      expect(card.querySelectorAll(".api-card__stat").length).toBe(3);
    });
  });

  it("supports compact density prop", () => {
    const { container } = render(<MarketplacePageSkeleton density="compact" />);

    const cards = container.querySelectorAll(".api-marketplace-card");
    expect(cards.length).toBe(12);
    cards.forEach((card) => {
      expect(card.classList.contains("api-card--compact")).toBe(true);
    });
  });

  it("decorates inner skeleton elements with aria-hidden for accessibility", () => {
    const { container } = render(<MarketplacePageSkeleton />);

    const rail = container.querySelector(".recently-active-rail-skeleton");
    expect(rail?.getAttribute("aria-hidden")).toBe("true");

    const sidebar = container.querySelector(".filters-sidebar-skeleton");
    expect(sidebar?.getAttribute("aria-hidden")).toBe("true");
  });
});
