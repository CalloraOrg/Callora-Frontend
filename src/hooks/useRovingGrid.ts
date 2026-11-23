import { useCallback, useEffect, useState, type KeyboardEvent, type RefObject } from "react";

export interface UseRovingGridOptions {
  /** Ref to the grid container element. */
  containerRef: RefObject<HTMLElement | null>;
  /** CSS selector matching each focusable grid item inside the container. */
  itemSelector: string;
  /** Total number of rendered items in the grid. */
  itemCount: number;
  /** Dependencies that should reset the active index back to 0 when changed. */
  resetDeps?: readonly unknown[];
}

export interface UseRovingGridResult {
  /** Index of the currently active (tabbable) item. */
  activeIndex: number;
  /** Manually update the active index (e.g. from an item's onFocus handler). */
  setActiveIndex: (index: number) => void;
  /** Keydown handler to attach to the grid container. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const INTERACTIVE_DESCENDANT_SELECTOR =
  "input, textarea, select, button, a, [contenteditable='true'], [contenteditable='']";

/**
 * Groups grid items into visual rows based on their `offsetTop` value.
 * Returns an array of rows, where each row is an array of item indices.
 */
function computeRows(items: HTMLElement[]): number[][] {
  const rows: number[][] = [];
  let currentTop: number | null = null;

  for (let i = 0; i < items.length; i++) {
    const top = items[i].offsetTop;
    if (currentTop === null || top !== currentTop) {
      rows.push([i]);
      currentTop = top;
    } else {
      rows[rows.length - 1].push(i);
    }
  }

  return rows;
}

/**
 * Implements the roving tabindex pattern for a responsive CSS Grid whose
 * column count is determined by CSS layout (e.g. `repeat(auto-fill, ...)`).
 *
 * - Only the active item receives `tabIndex={0}`; all other items receive `-1`.
 * - ArrowLeft / ArrowRight move by -1 / +1 (clamped, no wrap).
 * - ArrowUp / ArrowDown move by -columns / +columns (clamped, no wrap),
 *   where `columns` is derived from the number of items sharing the same `offsetTop`.
 * - Home / End jump to the first / last item of the current row.
 * - Ctrl+Home / Ctrl+End jump to the first / last item of the entire grid.
 * - Key events originating from inner interactive controls (buttons, inputs, etc.)
 *   are ignored so their native and custom keyboard handlers remain intact.
 */
export function useRovingGrid({
  containerRef,
  itemSelector,
  itemCount,
  resetDeps = [],
}: UseRovingGridOptions): UseRovingGridResult {
  const [activeIndex, setActiveIndexState] = useState(0);

  // Reset active index when page, filters, or density change.
  useEffect(() => {
    setActiveIndexState(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  // Ensure activeIndex never points past the end if itemCount shrinks.
  useEffect(() => {
    setActiveIndexState((prev) => {
      if (itemCount <= 0) return 0;
      return prev >= itemCount ? itemCount - 1 : prev;
    });
  }, [itemCount]);

  const setActiveIndex = useCallback(
    (index: number) => {
      if (itemCount <= 0) {
        setActiveIndexState(0);
        return;
      }
      const clamped = Math.max(0, Math.min(itemCount - 1, index));
      setActiveIndexState(clamped);
    },
    [itemCount],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (!container) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const currentItem = target.closest<HTMLElement>(itemSelector);
      if (!currentItem || !container.contains(currentItem)) return;

      // Ignore key events originating from inner interactive controls (buttons, inputs, etc.).
      if (target !== currentItem && target.closest(INTERACTIVE_DESCENDANT_SELECTOR)) {
        return;
      }

      const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
      if (items.length === 0) return;

      const currentIndex = items.indexOf(currentItem);
      if (currentIndex === -1) return;

      const rows = computeRows(items);
      const columns = rows[0]?.length ?? 1;
      const currentRow = rows.find((row) => row.includes(currentIndex)) ?? [currentIndex];

      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
          nextIndex = Math.min(items.length - 1, currentIndex + 1);
          break;
        case "ArrowLeft":
          nextIndex = Math.max(0, currentIndex - 1);
          break;
        case "ArrowDown":
          nextIndex = Math.min(items.length - 1, currentIndex + columns);
          break;
        case "ArrowUp":
          nextIndex = Math.max(0, currentIndex - columns);
          break;
        case "Home":
          nextIndex = event.ctrlKey ? 0 : currentRow[0];
          break;
        case "End":
          nextIndex = event.ctrlKey ? items.length - 1 : currentRow[currentRow.length - 1];
          break;
        default:
          return;
      }

      event.preventDefault();
      setActiveIndexState(nextIndex);
      items[nextIndex]?.focus();
    },
    [containerRef, itemSelector],
  );

  return {
    activeIndex: itemCount <= 0 ? 0 : Math.min(activeIndex, itemCount - 1),
    setActiveIndex,
    onKeyDown,
  };
}
