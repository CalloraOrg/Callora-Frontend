import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsModal } from "./ShortcutsModal";

function ShortcutsModalHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open shortcuts</button>
      <ShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

describe("ShortcutsModal", () => {
  it("focuses the search input when opened", () => {
    render(<ShortcutsModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("filters shortcuts by description and hides non-matching categories", () => {
    render(<ShortcutsModal isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "market" },
    });

    expect(
      screen.getByRole("heading", { name: "Marketplace" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Global" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Plan" }),
    ).not.toBeInTheDocument();
  });

  it("wraps Tab and Shift+Tab within the dialog", () => {
    render(<ShortcutsModal isOpen onClose={vi.fn()} />);
    const searchInput = screen.getByRole("searchbox");
    const closeButton = screen.getByRole("button", { name: "Close shortcuts" });

    fireEvent.keyDown(searchInput, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(searchInput).toHaveFocus();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("restores focus to the opener when closed", () => {
    render(<ShortcutsModalHarness />);
    const opener = screen.getByRole("button", { name: "Open shortcuts" });

    fireEvent.click(opener);
    expect(screen.getByRole("searchbox")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(opener).toHaveFocus();
  });
});