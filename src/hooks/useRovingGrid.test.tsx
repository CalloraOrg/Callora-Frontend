import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRovingGrid } from "./useRovingGrid";

interface TestGridProps {
  count?: number;
  columns?: number;
  resetKey?: string;
  onInnerButtonKeyDown?: (key: string) => void;
  onCardKeyDown?: (index: number, key: string) => void;
}

function TestGrid({
  count = 7,
  columns = 3,
  resetKey = "a",
  onInnerButtonKeyDown,
  onCardKeyDown,
}: TestGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeIndex, setActiveIndex, onKeyDown } = useRovingGrid({
    containerRef,
    itemSelector: ".grid-card",
    itemCount: count,
    resetDeps: [resetKey],
  });

  return (
    <div ref={containerRef} role="group" aria-label="Test grid" onKeyDown={onKeyDown}>
      {Array.from({ length: count }, (_, i) => (
        <article
          key={i}
          className="grid-card"
          data-row={Math.floor(i / columns)}
          role="button"
          tabIndex={i === activeIndex ? 0 : -1}
          onFocus={() => setActiveIndex(i)}
          onKeyDown={(e) => onCardKeyDown?.(i, e.key)}
        >
          <span>Card {i}</span>
          <button
            type="button"
            onKeyDown={(e) => onInnerButtonKeyDown?.(e.key)}
          >
            Action {i}
          </button>
          <input aria-label={`Input ${i}`} />
        </article>
      ))}
    </div>
  );
}

describe("useRovingGrid", () => {
  const originalOffsetTop = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetTop",
  );

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetTop", {
      configurable: true,
      get() {
        const row = this.getAttribute?.("data-row");
        return row !== null ? Number(row) * 240 : 0;
      },
    });
  });

  afterEach(() => {
    if (originalOffsetTop) {
      Object.defineProperty(HTMLElement.prototype, "offsetTop", originalOffsetTop);
    } else {
      delete (HTMLElement.prototype as { offsetTop?: number }).offsetTop;
    }
  });

  function getCards() {
    return Array.from(document.querySelectorAll<HTMLElement>(".grid-card"));
  }

  it("sets tabIndex=0 only on the active card and -1 on all others", () => {
    render(<TestGrid count={7} columns={3} />);
    const cards = getCards();

    expect(cards.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);
  });

  it("moves focus with ArrowRight and ArrowLeft and clamps at edges without wrapping", () => {
    render(<TestGrid count={7} columns={3} />);
    const cards = getCards();

    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cards[0]);
    expect(cards[0].tabIndex).toBe(0);

    fireEvent.keyDown(cards[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cards[1]);
    expect(cards[1].tabIndex).toBe(0);
    expect(cards[0].tabIndex).toBe(-1);

    // Jump to last card and ensure ArrowRight clamps
    cards[6].focus();
    fireEvent.keyDown(cards[6], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cards[6]);
  });

  it("moves focus with ArrowDown and ArrowUp respecting column count and partial last row", () => {
    // 7 items in 3 columns:
    // Row 0: 0, 1, 2
    // Row 1: 3, 4, 5
    // Row 2: 6
    render(<TestGrid count={7} columns={3} />);
    const cards = getCards();

    cards[1].focus();
    fireEvent.keyDown(cards[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cards[4]);

    // From Row 1 col 1 (index 4), ArrowDown (+3 -> 7) clamps to partial last row item 6
    fireEvent.keyDown(cards[4], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cards[6]);

    // From last row (index 6), ArrowDown clamps to 6
    fireEvent.keyDown(cards[6], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cards[6]);

    // From index 6, ArrowUp (-3 -> 3) moves to Row 1 col 0
    fireEvent.keyDown(cards[6], { key: "ArrowUp" });
    expect(document.activeElement).toBe(cards[3]);

    // From Row 0 col 1 (index 1), ArrowUp (-3 -> -2) clamps to 0
    cards[1].focus();
    fireEvent.keyDown(cards[1], { key: "ArrowUp" });
    expect(document.activeElement).toBe(cards[0]);
  });

  it("handles Home/End for row start/end and Ctrl+Home/Ctrl+End for grid start/end", () => {
    // 7 items in 3 columns: [0,1,2], [3,4,5], [6]
    render(<TestGrid count={7} columns={3} />);
    const cards = getCards();

    cards[4].focus();
    fireEvent.keyDown(cards[4], { key: "Home" });
    expect(document.activeElement).toBe(cards[3]);

    fireEvent.keyDown(cards[3], { key: "End" });
    expect(document.activeElement).toBe(cards[5]);

    // Ctrl+Home jumps to first card
    fireEvent.keyDown(cards[5], { key: "Home", ctrlKey: true });
    expect(document.activeElement).toBe(cards[0]);

    // Ctrl+End jumps to last card
    fireEvent.keyDown(cards[0], { key: "End", ctrlKey: true });
    expect(document.activeElement).toBe(cards[6]);

    // Home/End on partial last row stays on index 6
    fireEvent.keyDown(cards[6], { key: "Home" });
    expect(document.activeElement).toBe(cards[6]);
    fireEvent.keyDown(cards[6], { key: "End" });
    expect(document.activeElement).toBe(cards[6]);
  });

  it("ignores key events originating from inner buttons and inputs", () => {
    const onInnerButtonKeyDown = vi.fn();
    render(
      <TestGrid
        count={6}
        columns={3}
        onInnerButtonKeyDown={onInnerButtonKeyDown}
      />,
    );
    const cards = getCards();
    const innerBtn = screen.getByRole("button", { name: "Action 0" });
    const innerInput = screen.getByLabelText("Input 0");

    innerBtn.focus();
    fireEvent.keyDown(innerBtn, { key: "ArrowRight" });
    expect(document.activeElement).toBe(innerBtn);
    expect(onInnerButtonKeyDown).toHaveBeenCalledWith("ArrowRight");

    innerInput.focus();
    fireEvent.keyDown(innerInput, { key: "ArrowDown" });
    expect(document.activeElement).toBe(innerInput);
    expect(cards[0].tabIndex).toBe(0);
  });

  it("resets active index when resetDeps change and clamps when itemCount shrinks", () => {
    const { rerender } = render(<TestGrid count={6} columns={3} resetKey="a" />);
    const cards = getCards();

    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: "ArrowRight" });
    fireEvent.keyDown(cards[1], { key: "ArrowRight" });
    expect(getCards()[2].tabIndex).toBe(0);

    // Changing resetKey resets activeIndex back to 0
    rerender(<TestGrid count={6} columns={3} resetKey="b" />);
    expect(getCards().map((c) => c.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);

    // Move to index 4, then shrink count to 2 -> clamps to index 1
    getCards()[4].focus();
    expect(getCards()[4].tabIndex).toBe(0);
    rerender(<TestGrid count={2} columns={3} resetKey="b" />);
    expect(getCards().map((c) => c.tabIndex)).toEqual([-1, 0]);
  });
});
