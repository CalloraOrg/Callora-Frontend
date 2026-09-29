import { useCallback, useMemo, useRef, useState } from "react";

function encodeCursor(id: string): string {
  return btoa(id);
}

function decodeCursor(cursor: string): string {
  try {
    return atob(cursor);
  } catch {
    return "";
  }
}

export interface CursorPaginationResult<T> {
  pageItems: T[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  currentPageIndex: number;
  totalItemCount: number;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  resetCursor: () => void;
  currentCursor: string | null;
}

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
