import { useCallback, useMemo, useRef, useState } from "react";

function encodeCursor(id: string): string {
  const bytes = new TextEncoder().encode(id);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeCursor(cursor: string): string {
  try {
    const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
      return "";
    }

    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "";
  }
}

/**
 * Result object returned by the {@link useCursorPagination} hook.
 *
 * @template T - The item type, extending `{ id: string }`.
 */
export interface CursorPaginationResult<T> {
  /** The slice of items belonging to the current page. */
  pageItems: T[];
  /** Whether there is a subsequent page available after the current page. */
  hasNextPage: boolean;
  /** Whether there is a preceding page available before the current page. */
  hasPreviousPage: boolean;
  /** Zero-based index of the currently active page within calculated page boundaries. */
  currentPageIndex: number;
  /** Total number of items across all pages. */
  totalItemCount: number;
  /** Advances to the next page and pushes the current cursor onto the navigation history stack. */
  goToNextPage: () => void;
  /** Navigates to the previous page by popping the last cursor from the navigation history stack. */
  goToPreviousPage: () => void;
  /** Resets pagination state and clears navigation history, returning to the first page. */
  resetCursor: () => void;
  /**
   * The base64-encoded ID cursor for the first item on the current page,
   * or `null` if on the first page / uninitialized.
   */
  currentCursor: string | null;
}

/**
 * Client-side cursor-based pagination hook for collections of items with unique string IDs.
 *
 * Cursors are base64-encoded strings derived from the `id` property of items (`btoa(item.id)`).
 * The hook partitions the provided `items` array into pages of size `pageSize` and tracks the
 * active page cursor and navigation history.
 *
 * Side effects:
 * - **Page size changes reset position**: When `pageSize` or `items` change, page boundaries
 *   are recalculated. If `currentCursor` does not match any boundary in the new layout,
 *   pagination resets position back to the first page (index 0).
 * - **History tracking**: Maintains an internal stack of visited cursors (`cursorHistoryRef`)
 *   to support backward navigation (`goToPreviousPage`). Calling `resetCursor` clears this
 *   history stack and sets `currentCursor` to `null`.
 *
 * @template T - The item type, which must have an `id: string` property.
 * @param items - The full array of items to paginate. Each item must have an `id: string`.
 * @param pageSize - The number of items per page. Changing this value recalculates boundaries
 *   and resets the current page position if the active cursor no longer aligns.
 * @param initialCursor - Optional initial base64-encoded cursor to start pagination from.
 *   Defaults to `null` (starts on the first page).
 * @returns A {@link CursorPaginationResult} object containing:
 * - `pageItems`: Array of items on the current page slice.
 * - `hasNextPage`: Boolean indicating if a subsequent page exists.
 * - `hasPreviousPage`: Boolean indicating if a preceding page exists.
 * - `currentPageIndex`: Zero-based index of the active page.
 * - `totalItemCount`: Total number of items in the `items` array.
 * - `goToNextPage`: Function to advance to the next page and push the previous cursor onto history.
 * - `goToPreviousPage`: Function to navigate to the previous page by popping from history.
 * - `resetCursor`: Function to clear navigation history and reset the cursor to `null`.
 * - `currentCursor`: The base64-encoded ID cursor of the current page's first item, or `null`.
 *
 * @example
 * ```tsx
 * interface Item {
 *   id: string;
 *   title: string;
 * }
 *
 * function ItemList({ items }: { items: Item[] }) {
 *   const {
 *     pageItems,
 *     currentPageIndex,
 *     hasNextPage,
 *     hasPreviousPage,
 *     goToNextPage,
 *     goToPreviousPage,
 *     resetCursor,
 *   } = useCursorPagination(items, 10);
 *
 *   return (
 *     <div>
 *       <ul>
 *         {pageItems.map((item) => (
 *           <li key={item.id}>{item.title}</li>
 *         ))}
 *       </ul>
 *       <button onClick={goToPreviousPage} disabled={!hasPreviousPage}>
 *         Previous
 *       </button>
 *       <span>Page {currentPageIndex + 1}</span>
 *       <button onClick={goToNextPage} disabled={!hasNextPage}>
 *         Next
 *       </button>
 *       <button onClick={resetCursor}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCursorPagination<T extends { id: string }>(
  items: T[],
  pageSize: number,
  initialCursor: string | null = null,
): CursorPaginationResult<T> {
  const [currentCursor, setCurrentCursor] = useState<string | null>(
    initialCursor,
  );

  const cursorHistoryRef = useRef<string[]>([]);

  const pageBoundaries = useMemo(() => {
    if (items.length === 0) {
      return [{ start: 0, end: 0, cursor: null }];
    }

    const boundaries: { start: number; end: number; cursor: string | null }[] =
      [];

    for (let i = 0; i < items.length; i += pageSize) {
      boundaries.push({
        start: i,
        end: Math.min(i + pageSize, items.length),
        cursor: encodeCursor(items[i].id),
      });
    }

    return boundaries;
  }, [items, pageSize]);

  const currentPageIndex = useMemo(() => {
    if (!currentCursor || pageBoundaries.length === 0) return 0;

    const idx = pageBoundaries.findIndex(
      (b) => b.cursor === currentCursor,
    );

    return idx >= 0 ? idx : 0;
  }, [currentCursor, pageBoundaries]);

  const pageItems = useMemo(() => {
    if (pageBoundaries.length === 0) return [];

    const boundary = pageBoundaries[currentPageIndex] ?? pageBoundaries[0];
    return items.slice(boundary.start, boundary.end);
  }, [items, pageBoundaries, currentPageIndex]);

  const hasNextPage = currentPageIndex < pageBoundaries.length - 1;
  const hasPreviousPage = currentPageIndex > 0;

  const goToNextPage = useCallback(() => {
    if (!hasNextPage) return;

    const nextIndex = currentPageIndex + 1;
    const nextBoundary = pageBoundaries[nextIndex];

    if (nextBoundary) {
      cursorHistoryRef.current.push(currentCursor ?? "");
      setCurrentCursor(nextBoundary.cursor);
    }
  }, [hasNextPage, currentPageIndex, pageBoundaries, currentCursor]);

  const goToPreviousPage = useCallback(() => {
    if (!hasPreviousPage) return;

    const prevCursor = cursorHistoryRef.current.pop();
    if (prevCursor !== undefined) {
      setCurrentCursor(prevCursor || null);
    }
  }, [hasPreviousPage]);

  const resetCursor = useCallback(() => {
    cursorHistoryRef.current = [];
    setCurrentCursor(null);
  }, []);

  return {
    pageItems,
    hasNextPage,
    hasPreviousPage,
    currentPageIndex,
    totalItemCount: items.length,
    goToNextPage,
    goToPreviousPage,
    resetCursor,
    currentCursor,
  };
}
