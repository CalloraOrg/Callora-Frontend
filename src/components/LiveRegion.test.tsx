// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LiveRegion from "./LiveRegion";

describe("LiveRegion", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with empty text when message is empty", () => {
    render(<LiveRegion message="" />);
    const region = screen.getByTestId("live-region");
    expect(region).toBeTruthy();
    expect(region.textContent).toBe("");
    expect(region.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the message in a sr-only element when non-empty", () => {
    render(<LiveRegion message="Filters applied" />);
    const region = screen.getByTestId("live-region");
    expect(region).toBeTruthy();
    expect(region.textContent).toContain("Filters applied");
  });

  it("uses role='status' and aria-live='polite' by default", () => {
    render(<LiveRegion message="Results updated" />);
    const region = screen.getByTestId("live-region");
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("uses role='alert' and aria-live='assertive' when assertive=true", () => {
    render(<LiveRegion message="Error occurred" assertive />);
    const region = screen.getByTestId("live-region");
    expect(region.getAttribute("role")).toBe("alert");
    expect(region.getAttribute("aria-live")).toBe("assertive");
  });

  it("includes aria-atomic='true' for complete message announcement", () => {
    render(<LiveRegion message="Test announcement" />);
    const region = screen.getByTestId("live-region");
    expect(region.getAttribute("aria-atomic")).toBe("true");
  });

  it("has the sr-only class for visual hiding", () => {
    render(<LiveRegion message="Hidden text" />);
    const region = screen.getByTestId("live-region");
    expect(region.classList.contains("sr-only")).toBe(true);
  });

  it("updates the message text when the message prop changes", () => {
    const { rerender } = render(<LiveRegion message="First message" />);
    expect(screen.getByTestId("live-region").textContent).toContain("First message");

    rerender(<LiveRegion message="Second message" />);
    expect(screen.getByTestId("live-region").textContent).toContain("Second message");
  });
});
