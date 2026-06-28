// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ApiDetailPageSkeleton from "./ApiDetailPage.skeleton";

describe("ApiDetailPageSkeleton", () => {
  it("renders a busy route shell that mirrors the detail layout", () => {
    const { container, getByLabelText } = render(<ApiDetailPageSkeleton />);

    expect(
      getByLabelText("API detail loading shell").getAttribute("aria-busy"),
    ).toBe("true");
    expect(container.querySelector(".api-detail-shell")).toBeTruthy();
    expect(container.querySelector(".api-detail-hero")).toBeTruthy();
    expect(container.querySelector(".api-detail-tabs")).toBeTruthy();
    expect(container.querySelectorAll(".stat-card-skeleton").length).toBe(3);
    expect(container.querySelectorAll(".preview-card-skeleton").length).toBe(3);
  });
});
