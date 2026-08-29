// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import MarketplacePageSkeleton from "./MarketplacePage.skeleton";
import { ApiCardSkeleton } from "../components/ApiCard";
import { cleanup } from "@testing-library/react";

describe("MarketplacePageSkeleton", () => {
  afterEach(cleanup);

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

describe("ApiCardSkeleton narrow-screen layout stability (#1010)", () => {
  afterEach(cleanup);

  it("renders the api-card-skeleton class for responsive CSS targeting", () => {
    const { container } = render(<ApiCardSkeleton />);
    const card = container.querySelector(".api-card-skeleton");
    expect(card).toBeTruthy();
  });

  it("includes api-marketplace-card-header for grid layout on narrow screens", () => {
    const { container } = render(<ApiCardSkeleton />);
    const header = container.querySelector(".api-marketplace-card-header");
    expect(header).toBeTruthy();
  });

  it("includes api-card__stats with 3 stat cells for layout stability", () => {
    const { container } = render(<ApiCardSkeleton />);
    const stats = container.querySelector(".api-card__stats");
    expect(stats).toBeTruthy();
    expect(stats?.querySelectorAll(".api-card__stat").length).toBe(3);
  });

  it("uses min-height CSS variable for responsive adaptation", () => {
    const { container } = render(<ApiCardSkeleton />);
    const card = container.querySelector(".api-card-skeleton") as HTMLElement;
    expect(card).toBeTruthy();
    // The card should use CSS custom property for min-height
    const minHeight = card.style.minHeight;
    expect(minHeight).toContain("var(--mkt-card-min-height");
  });

  it("compact skeleton uses compact min-height for layout parity", () => {
    const { container } = render(<ApiCardSkeleton density="compact" />);
    const card = container.querySelector(".api-card-skeleton") as HTMLElement;
    expect(card).toBeTruthy();
    const minHeight = card.style.minHeight;
    expect(minHeight).toContain("var(--mkt-card-compact-min-height");
  });

  it("skeletons have consistent structure between compact and comfortable modes", () => {
    const { container: comfortContainer } = render(<ApiCardSkeleton density="comfortable" />);
    const { container: compactContainer } = render(<ApiCardSkeleton density="compact" />);

    const comfortStats = comfortContainer.querySelectorAll(".api-card__stat").length;
    const compactStats = compactContainer.querySelectorAll(".api-card__stat").length;
    expect(comfortStats).toBe(compactStats);
  });
});
