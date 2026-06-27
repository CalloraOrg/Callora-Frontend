import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RatingHistogram from "./RatingHistogram";

describe("RatingHistogram", () => {
  it("renders children correctly", () => {
    render(
      <RatingHistogram rating={4.5}>
        <span data-testid="child">4.5 Stars</span>
      </RatingHistogram>
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("shows tooltip on mouse enter and hides on mouse leave", async () => {
    render(<RatingHistogram rating={4.5}>Hover me</RatingHistogram>);
    
    const trigger = screen.getByText("Hover me");
    
    // Tooltip should not be visible initially
    expect(screen.queryByRole("tooltip")).toBeNull();
    
    // Trigger mouse enter
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole("tooltip")).toBeDefined();
    expect(screen.getByText("4.5")).toBeDefined();
    
    // Trigger mouse leave
    fireEvent.mouseLeave(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("shows tooltip on long press (touch)", async () => {
    render(<RatingHistogram rating={4.2}>Touch me</RatingHistogram>);
    
    const trigger = screen.getByText("Touch me");
    
    // Trigger touch start
    fireEvent.touchStart(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    
    // Wait for the long press duration
    expect(await screen.findByRole("tooltip", undefined, { timeout: 1000 })).toBeDefined();
    
    // Trigger touch end
    fireEvent.touchEnd(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("uses provided distribution data", async () => {
    const customDist = { 5: 100, 4: 50, 3: 0, 2: 0, 1: 0 };
    render(
      <RatingHistogram rating={4.8} distribution={customDist}>
        Hover me
      </RatingHistogram>
    );
    
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    
    // Wait for tooltip to appear
    await screen.findByRole("tooltip");

    // Find rows and verify counts are rendered
    expect(screen.getByText("100")).toBeDefined();
    expect(screen.getByText("50")).toBeDefined();
    // 1 star count is 0, which might match other things, so let's just check the ones that are unique
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("100");
    expect(tooltip.textContent).toContain("50");
  });
});
