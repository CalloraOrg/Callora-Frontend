// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodChip } from "./MethodChip";

afterEach(cleanup);

describe("MethodChip", () => {
  it("renders with the HTTP method text uppercased", () => {
    render(<MethodChip method="get" />);
    expect(screen.getByLabelText("GET request")).toBeTruthy();
    expect(screen.getByText("GET")).toBeTruthy();
  });

  it("renders an icon for the HTTP method", () => {
    const { container } = render(<MethodChip method="POST" />);
    const chip = screen.getByLabelText("POST request");
    const icon = chip.querySelector(".method-chip-icon");
    expect(icon).toBeTruthy();
    expect(icon?.querySelector("svg")).toBeTruthy();
  });

  it("is focusable via tabIndex={0}", () => {
    render(<MethodChip method="GET" />);
    const chip = screen.getByLabelText("GET request");
    expect(chip.getAttribute("tabindex")).toBe("0");
  });

  it("shows tooltip on focus and hides on blur", () => {
    render(<MethodChip method="PUT" />);
    const chip = screen.getByLabelText("PUT request");

    // No tooltip initially
    expect(screen.queryByRole("tooltip")).toBeNull();

    // Focus should show tooltip
    fireEvent.focus(chip);
    expect(screen.getByRole("tooltip")).toBeTruthy();

    // Blur should hide tooltip
    fireEvent.blur(chip);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // ── Mobile layout — CSS-class contract (Issue #744) ─────────────────────
  //
  // jsdom does not evaluate @media rules, so we verify the *class contract*:
  // the correct CSS classes are present so the @media breakpoint rules can
  // apply in a real browser.

  it("has .method-chip class for responsive styling", () => {
    render(<MethodChip method="GET" />);
    const chip = screen.getByLabelText("GET request");
    expect(chip.classList.contains("method-chip")).toBe(true);
  });

  it("has the matching method-chip-icon class on the icon wrapper", () => {
    render(<MethodChip method="GET" />);
    const chip = screen.getByLabelText("GET request");
    const icon = chip.querySelector(".method-chip-icon");
    expect(icon).toBeTruthy();
  });

  it("renders known HTTP methods with dedicated colors", () => {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    methods.forEach((method) => {
      const { unmount } = render(<MethodChip method={method} />);
      const chip = screen.getByLabelText(`${method} request`);
      // Colors should be set via CSS custom properties, never inline hex
      expect(chip.style.backgroundColor).toMatch(/^var\(--method-/);
      expect(chip.style.color).toMatch(/^var\(--method-/);
      unmount();
    });
  });

  it("falls back to default colors for unknown methods", () => {
    render(<MethodChip method="OPTIONS" />);
    const chip = screen.getByLabelText("OPTIONS request");
    expect(chip.style.backgroundColor).toBe("var(--surface-soft)");
    expect(chip.style.color).toBe("var(--text)");
  });

  it("uses design-token background for GET, POST, PUT, DELETE, PATCH", () => {
    const checks: Record<string, { bg: string; fg: string }> = {
      GET: { bg: "var(--method-get-bg)", fg: "var(--method-get-fg)" },
      POST: { bg: "var(--method-post-bg)", fg: "var(--method-post-fg)" },
      PUT: { bg: "var(--method-put-bg)", fg: "var(--method-put-fg)" },
      DELETE: { bg: "var(--method-delete-bg)", fg: "var(--method-delete-fg)" },
      PATCH: { bg: "var(--method-patch-bg)", fg: "var(--method-patch-fg)" },
    };

    Object.entries(checks).forEach(([method, colors]) => {
      const { unmount } = render(<MethodChip method={method} />);
      const chip = screen.getByLabelText(`${method} request`);
      expect(chip.style.backgroundColor).toBe(colors.bg);
      expect(chip.style.color).toBe(colors.fg);
      unmount();
    });
  });
});
