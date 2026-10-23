// @vitest-environment jsdom

import React from "react";
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Skeleton, { SkeletonRow } from "./Skeleton";

describe("Skeleton Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Skeleton with correct styles and class name", () => {
    const { container } = render(
      <Skeleton width="100px" height="20px" borderRadius="8px" className="custom-class" />
    );
    const skeletonDiv = container.querySelector(".skeleton");
    expect(skeletonDiv).toBeTruthy();
    expect(skeletonDiv?.classList.contains("custom-class")).toBe(true);

    const style = (skeletonDiv as HTMLElement).style;
    expect(style.width).toBe("100px");
    expect(style.height).toBe("20px");
    expect(style.borderRadius).toBe("8px");
  });

  it("adds the Stellar themed skeleton class when requested", () => {
    const { container } = render(<Skeleton tone="stellar" />);
    expect(container.querySelector(".skeleton--stellar")).toBeTruthy();
  });

  it("renders SkeletonRow with correct number of rows and elements", () => {
    const { container } = render(<SkeletonRow rows={3} />);
    const rows = container.querySelectorAll(".table-row");
    expect(rows.length).toBe(3);

    rows.forEach((row) => {
      const cells = row.querySelectorAll(".skeleton");
      expect(cells.length).toBe(7);
    });
  });
});
