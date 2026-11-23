import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RatingHistogram from "./RatingHistogram";

const getTrigger = (label: string) =>
  screen.getByText(label).closest(".rating-histogram") as HTMLElement;

describe("RatingHistogram", () => {
  it("renders children", () => {
    render(
      <RatingHistogram rating={4.5} distribution={{ 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }}>
        <span data-testid="child">4.5 Stars</span>
      </RatingHistogram>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("shows tooltip on mouse enter and hides (after grace period) on mouse leave", async () => {
    render(<RatingHistogram rating={4.5} distribution={{ 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }}>Hover me</RatingHistogram>);
    const trigger = getTrigger("Hover me");

    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole("tooltip")).toBeDefined();
    expect(screen.getByText("4.5")).toBeDefined();

    fireEvent.mouseLeave(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("keeps tooltip open when pointer moves from trigger onto the tooltip (WCAG hoverable)", async () => {
    render(<RatingHistogram rating={4.5} distribution={{ 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }}>Hover me</RatingHistogram>);
    const trigger = getTrigger("Hover me");

    fireEvent.mouseEnter(trigger);
    const tooltip = await screen.findByRole("tooltip");

    // Pointer leaves the trigger but enters the tooltip before the close timer fires.
    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(tooltip);

    // Wait past the close delay; tooltip should still be present.
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole("tooltip")).not.toBeNull();

    fireEvent.mouseLeave(tooltip);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("opens on focus and closes on blur (keyboard accessibility)", async () => {
    render(<RatingHistogram rating={3.7} distribution={{ 5: 5, 4: 3, 3: 2, 2: 1, 1: 1 }}>Focus me</RatingHistogram>);
    const trigger = getTrigger("Focus me");

    fireEvent.focus(trigger);
    expect(await screen.findByRole("tooltip")).toBeDefined();

    fireEvent.blur(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("dismisses on Escape (WCAG dismissible)", async () => {
    render(<RatingHistogram rating={4.0} distribution={{ 5: 10, 4: 10, 3: 5, 2: 2, 1: 1 }}>Hover me</RatingHistogram>);
    const trigger = getTrigger("Hover me");

    fireEvent.mouseEnter(trigger);
    await screen.findByRole("tooltip");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("shows tooltip on long press (touch) and hides on touchend", async () => {
    render(<RatingHistogram rating={4.2} distribution={{ 5: 8, 4: 6, 3: 4, 2: 2, 1: 1 }}>Touch me</RatingHistogram>);
    const trigger = getTrigger("Touch me");

    fireEvent.touchStart(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();

    // Wait past the long-press threshold.
    expect(
      await screen.findByRole("tooltip", undefined, { timeout: 1000 }),
    ).toBeDefined();

    fireEvent.touchEnd(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("does not show tooltip if touch is released before long-press threshold", async () => {
    render(<RatingHistogram rating={4.2} distribution={{ 5: 8, 4: 6, 3: 4, 2: 2, 1: 1 }}>Tap me</RatingHistogram>);
    const trigger = getTrigger("Tap me");

    fireEvent.touchStart(trigger);
    // Release quickly — short tap should never reveal the tooltip.
    await new Promise((r) => setTimeout(r, 100));
    fireEvent.touchEnd(trigger);
    await new Promise((r) => setTimeout(r, 500));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("uses provided distribution and renders a row per star value", async () => {
    const customDist = { 5: 100, 4: 50, 3: 10, 2: 5, 1: 1 };
    render(
      <RatingHistogram rating={4.8} distribution={customDist}>
        Hover me
      </RatingHistogram>,
    );
    fireEvent.mouseEnter(getTrigger("Hover me"));
    const tooltip = await screen.findByRole("tooltip");

    // One labelled row per star value.
    expect(tooltip.querySelectorAll('[aria-label$="reviews"], [aria-label$="review"]').length).toBe(5);
    expect(tooltip.textContent).toContain("100");
    expect(tooltip.textContent).toContain("50");
    // Total reviews shown.
    expect(tooltip.textContent).toContain("166 reviews");
  });

  it("does not crash when all distribution counts are zero", async () => {
    render(
      <RatingHistogram rating={0} distribution={{ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }}>
        Hover me
      </RatingHistogram>,
    );
    fireEvent.mouseEnter(getTrigger("Hover me"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toBeDefined();
    // No "X reviews" string when total is 0.
    expect(tooltip.textContent).not.toMatch(/\d+\s+reviews?/);
  });

  it("stops click propagation so a clickable ancestor is not activated", () => {
    let parentClicked = false;
    render(
      <div onClick={() => (parentClicked = true)}>
        <RatingHistogram rating={4.5} distribution={{ 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }}>Hover me</RatingHistogram>
      </div>,
    );
    fireEvent.click(getTrigger("Hover me"));
    expect(parentClicked).toBe(false);
  });

  it("sets aria-describedby only while the tooltip is visible", async () => {
    render(<RatingHistogram rating={4.5} distribution={{ 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }}>Hover me</RatingHistogram>);
    const trigger = getTrigger("Hover me");

    expect(trigger.getAttribute("aria-describedby")).toBeNull();
    fireEvent.mouseEnter(trigger);
    const tooltip = await screen.findByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
  });

  it("shows 'No rating breakdown yet' when distribution prop is omitted", async () => {
    render(<RatingHistogram rating={4.5}>No dist</RatingHistogram>);
    fireEvent.mouseEnter(getTrigger("No dist"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("No rating breakdown yet");
    // No bars rendered
    expect(tooltip.querySelectorAll('[aria-label$="reviews"], [aria-label$="review"]').length).toBe(0);
    // No review count in accessible label
    expect(getTrigger("No dist").getAttribute("aria-label")).not.toMatch(/\d+\s+reviews?/);
  });

  it("shows 'No rating breakdown yet' when all distribution counts are zero", async () => {
    render(
      <RatingHistogram rating={0} distribution={{ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }}>
        Zero dist
      </RatingHistogram>,
    );
    fireEvent.mouseEnter(getTrigger("Zero dist"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("No rating breakdown yet");
    expect(tooltip.querySelectorAll('[aria-label$="reviews"], [aria-label$="review"]').length).toBe(0);
  });

  it("aria-label contains no review count when distribution is absent", () => {
    render(<RatingHistogram rating={4.5}>No dist label</RatingHistogram>);
    const trigger = getTrigger("No dist label");
    expect(trigger.getAttribute("aria-label")).toBe("Rating 4.5 out of 5");
  });

  it("aria-label handles NaN rating without crashing", () => {
    render(<RatingHistogram rating={NaN}>NaN rating</RatingHistogram>);
    const trigger = getTrigger("NaN rating");
    expect(trigger.getAttribute("aria-label")).not.toContain("NaN");
  });
});
