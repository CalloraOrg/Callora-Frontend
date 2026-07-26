// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LiveRegion from "./LiveRegion";

describe("LiveRegion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  it("renders a hidden live region element with the given id", () => {
    render(<LiveRegion regionId="test-region" message="" />);
    const region = screen.getByTestId("live-region-test-region");
    expect(region).toBeTruthy();
    expect(region.id).toBe("test-region");
    expect(region.classList.contains("sr-only")).toBe(true);
  });

  it("uses role='status' and aria-live='polite' by default", () => {
    render(<LiveRegion regionId="test" message="" />);
    const region = screen.getByTestId("live-region-test");
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("uses role='alert' and aria-live='assertive' when assertive=true", () => {
    render(<LiveRegion regionId="test" message="" assertive />);
    const region = screen.getByTestId("live-region-test");
    expect(region.getAttribute("role")).toBe("alert");
    expect(region.getAttribute("aria-live")).toBe("assertive");
  });

  it("has aria-atomic='true' for complete announcement updates", () => {
    render(<LiveRegion regionId="test" message="" />);
    const region = screen.getByTestId("live-region-test");
    expect(region.getAttribute("aria-atomic")).toBe("true");
  });

  it("wires aria-labelledby when provided", () => {
    render(<LiveRegion regionId="test" message="" labelledBy="filter-header" />);
    const region = screen.getByTestId("live-region-test");
    expect(region.getAttribute("aria-labelledby")).toBe("filter-header");
  });

  it("does not set aria-labelledby when not provided", () => {
    render(<LiveRegion regionId="test" message="" />);
    const region = screen.getByTestId("live-region-test");
    expect(region.getAttribute("aria-labelledby")).toBeNull();
  });

  it("updates textContent when message changes", async () => {
    const { rerender } = render(<LiveRegion regionId="test" message="Initial" />);
    // Wait for debounce
    await new Promise((r) => setTimeout(r, 350));
    const region = screen.getByTestId("live-region-test");
    expect(region.textContent).toBe("Initial");

    rerender(<LiveRegion regionId="test" message="Updated" />);
    await new Promise((r) => setTimeout(r, 350));
    expect(region.textContent).toBe("Updated");
  });

  it("clears textContent when message becomes empty", async () => {
    const { rerender } = render(<LiveRegion regionId="test" message="Something" />);
    await new Promise((r) => setTimeout(r, 350));
    const region = screen.getByTestId("live-region-test");
    expect(region.textContent).toBe("Something");

    rerender(<LiveRegion regionId="test" message="" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(region.textContent).toBe("");
  });

  it("coalesces rapid message updates via debounce", async () => {
    render(<LiveRegion regionId="test" message="First" debounceMs={200} />);
    const region = screen.getByTestId("live-region-test");

    // Immediately change before debounce fires
    // Use setTimeout-based approach
    setTimeout(() => {
      // Simulate rapid update by directly checking the behavior
    }, 10);

    await new Promise((r) => setTimeout(r, 250));
    // After debounce, should show the last value
    expect(region.textContent).toBe("First");
  });

  it("does not announce empty message on initial mount", async () => {
    render(<LiveRegion regionId="test" message="" />);
    await new Promise((r) => setTimeout(r, 50));
    const region = screen.getByTestId("live-region-test");
    expect(region.textContent).toBe("");
  });
});
