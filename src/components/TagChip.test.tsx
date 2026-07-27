// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TagChip from "./TagChip";

afterEach(cleanup);

describe("TagChip", () => {
  it("renders with tag text and hashtag prefix", () => {
    render(<TagChip tag="FWC26" />);

    const button = screen.getByRole("button", { name: "Filter marketplace by tag FWC26" });
    expect(button).toBeTruthy();
    expect(button.textContent).toContain("#");
    expect(button.textContent).toContain("FWC26");
  });

  it("applies the tabular-nums class to support vertical alignment for digits/amounts/counts", () => {
    render(<TagChip tag="FWC26" />);

    const button = screen.getByRole("button", { name: "Filter marketplace by tag FWC26" });
    expect(button.className).toContain("tabular-nums");
  });

  it("sets aria-pressed correctly when active/inactive", () => {
    const { rerender } = render(<TagChip tag="FWC26" active={false} />);
    const buttonInactive = screen.getByRole("button", { name: "Filter marketplace by tag FWC26" });
    expect(buttonInactive.getAttribute("aria-pressed")).toBe("false");

    rerender(<TagChip tag="FWC26" active={true} />);
    const buttonActive = screen.getByRole("button", { name: "Filter marketplace by tag FWC26" });
    expect(buttonActive.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onClick callback when clicked", () => {
    const onClick = vi.fn();
    render(<TagChip tag="FWC26" onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Filter marketplace by tag FWC26" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledWith("FWC26");
  });
});
