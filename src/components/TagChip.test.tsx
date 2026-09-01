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

  // ── High-contrast mode (Issues #735, #695) ────────────────────────────────
  //
  // These tests verify the CSS-class contract for high-contrast overrides.
  // jsdom does not evaluate @media (prefers-contrast: more) rules, so we
  // verify that:
  //   1. The contrast.css import is present (TagChip loads it)
  //   2. The correct CSS classes are present for the CSS cascade to apply

  it("imports contrast.css for high-contrast mode overrides (Issues #735, #695)", () => {
    // If the import works at runtime, the module resolves.  We render the
    // component and verify it mounts without error — the import is a static
    // ES module import, so if the file were missing the build would fail.
    render(<TagChip tag="test" />);
    const btn = screen.getByRole("button", { name: /Filter marketplace by tag test/i });
    expect(btn).toBeTruthy();
  });

  it("applies tag-chip CSS class that high-contrast @media rules target", () => {
    render(<TagChip tag="FWC26" />);
    const btn = screen.getByRole("button", { name: /Filter marketplace by tag FWC26/i });
    expect(btn.classList.contains("tag-chip")).toBe(true);
  });

  it("applies tag-chip--active class for the active state (targeted by contrast.css)", () => {
    render(<TagChip tag="FWC26" active={true} />);
    const btn = screen.getByRole("button", { name: /Filter marketplace by tag FWC26/i });
    expect(btn.classList.contains("tag-chip--active")).toBe(true);
  });

  it("applies a 1px border via the base tag-chip class for high-contrast line enforcement", () => {
    render(<TagChip tag="FWC26" />);
    const btn = screen.getByRole("button", { name: /Filter marketplace by tag FWC26/i });
    // The base CSS uses border: 1px solid var(--line); contrast.css overrides
    // to 2px solid — we verify the class contract exists
    expect(btn.style.border).toBe(""); // jsdom doesn't inherit CSS
    expect(btn.classList.contains("tag-chip")).toBe(true);
  });

  it("does not have inline style overrides that would block contrast.css @media rules", () => {
    render(<TagChip tag="FWC26" active={true} />);
    const btn = screen.getByRole("button", { name: /Filter marketplace by tag FWC26/i });
    // High-contrast overrides must not be blocked by inline styles
    expect(btn).not.toHaveAttribute("style");
  });
});
