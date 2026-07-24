// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import FiltersBottomSheet from "./FiltersBottomSheet";

// Mock window.matchMedia for the prefers-reduced-motion check
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const baseProps = {
  open: true,
  onClose: vi.fn(),
  resultCount: 42,
  selectedCategories: new Set<string>(),
  toggleCategory: vi.fn(),
  minPrice: null,
  maxPrice: null,
  setMinPrice: vi.fn(),
  setMaxPrice: vi.fn(),
  popularity: "any",
  setPopularity: vi.fn(),
  clearFilters: vi.fn(),
  favoritesOnly: false,
  toggleFavoritesOnly: vi.fn(),
  triggerRef: createRef<HTMLButtonElement>(),
};

describe("FiltersBottomSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement window.matchMedia; provide a minimal stub.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    // Reset body overflow in case a test left it set
    document.body.style.overflow = "";
  });

  it("renders nothing when closed", () => {
    render(<FiltersBottomSheet {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByTestId("bottom-sheet-backdrop")).toBeNull();
  });

  it("renders the dialog and backdrop when open", () => {
    render(<FiltersBottomSheet {...baseProps} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("bottom-sheet-backdrop")).toBeTruthy();
  });

  it("shows 'Show 42 results' footer button", () => {
    render(<FiltersBottomSheet {...baseProps} />);
    expect(screen.getByText(/Show 42 results/i)).toBeTruthy();
  });

  it("shows singular 'result' when resultCount is 1", () => {
    render(<FiltersBottomSheet {...baseProps} resultCount={1} />);
    expect(screen.getByText(/Show 1 result$/i)).toBeTruthy();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<FiltersBottomSheet {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("bottom-sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when ESC is pressed", () => {
    const onClose = vi.fn();
    render(<FiltersBottomSheet {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<FiltersBottomSheet {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close filters/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the 'Show results' footer button is clicked", () => {
    const onClose = vi.fn();
    render(<FiltersBottomSheet {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText(/Show 42 results/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sets body overflow hidden when open and restores it on unmount", () => {
    const { unmount } = render(<FiltersBottomSheet {...baseProps} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("starts with the half snap class", () => {
    render(<FiltersBottomSheet {...baseProps} />);
    const sheet = screen.getByTestId("bottom-sheet");
    expect(sheet.classList.contains("bottom-sheet--half")).toBe(true);
  });

  it("has aria-modal and role=dialog attributes", () => {
    render(<FiltersBottomSheet {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Filters");
  });

  it("restores focus to triggerRef when sheet closes", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    const triggerRef = { current: btn } as React.RefObject<HTMLButtonElement>;
    const focusSpy = vi.spyOn(btn, "focus");

    const { rerender } = render(
      <FiltersBottomSheet {...baseProps} triggerRef={triggerRef} open={true} />,
    );
    rerender(
      <FiltersBottomSheet {...baseProps} triggerRef={triggerRef} open={false} />,
    );
    expect(focusSpy).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it("does not render ESC listener when closed", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <FiltersBottomSheet {...baseProps} onClose={onClose} open={true} />,
    );
    rerender(
      <FiltersBottomSheet {...baseProps} onClose={onClose} open={false} />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    // The ESC should not call onClose after close (listener removed)
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders FiltersSidebar filter controls inside the body", () => {
    render(<FiltersBottomSheet {...baseProps} />);
    // FiltersSidebar renders a 'Categories' fieldset legend
    expect(screen.getByText(/Categories/i)).toBeTruthy();
  });
});
