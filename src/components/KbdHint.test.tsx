import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import KbdHint from "./KbdHint";

describe("KbdHint", () => {
  it("renders null when no shortcuts or shortcut are provided", () => {
    const { container } = render(<KbdHint />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when empty shortcuts array is provided", () => {
    const { container } = render(<KbdHint shortcuts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders list of shortcuts with default aside wrapper", () => {
    const shortcuts = [
      { key: "Ctrl+S", description: "Save", category: "Global" },
      { key: "Esc", description: "Close", category: "Global" },
    ];
    render(<KbdHint shortcuts={shortcuts} label="Custom label" />);

    const aside = screen.getByRole("complementary", { name: "Custom label" });
    expect(aside).toBeTruthy();
    expect(aside.tagName.toLowerCase()).toBe("aside");
    expect(screen.getByText("Ctrl+S")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Esc")).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("renders single shortcut object", () => {
    render(
      <KbdHint
        shortcut={{ key: "Ctrl+Enter", description: "Submit", category: "Form" }}
      />
    );
    expect(screen.getByText("Ctrl+Enter")).toBeTruthy();
    expect(screen.getByText("Submit")).toBeTruthy();
  });

  it("applies variant classes and defaults to span element for chip variant", () => {
    const { container } = render(
      <KbdHint
        shortcut={{ key: "⌘S", description: "Save", category: "Quota" }}
        variant="chip"
        label="Chip hint"
      />
    );
    const element = container.querySelector(".kbd-hint--chip");
    expect(element).toBeTruthy();
    expect(element?.tagName.toLowerCase()).toBe("span");
    expect(element?.getAttribute("aria-label")).toBe("Chip hint");
  });

  it("supports subtle variant and custom element override", () => {
    const { container } = render(
      <KbdHint
        shortcut={{ key: "Enter", description: "Confirm", category: "Action" }}
        variant="subtle"
        as="div"
        className="custom-class"
      />
    );
    const element = container.querySelector(".kbd-hint--subtle");
    expect(element).toBeTruthy();
    expect(element?.tagName.toLowerCase()).toBe("div");
    expect(element?.classList.contains("custom-class")).toBe(true);
  });
});
