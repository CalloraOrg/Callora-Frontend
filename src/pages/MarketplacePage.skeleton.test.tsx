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
});
