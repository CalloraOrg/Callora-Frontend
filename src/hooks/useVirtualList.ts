/**
 * useVirtualList — windowing for arbitrarily large flat lists.
 *
 * Renders only the slice of items that intersect the scroll container's
 * viewport (plus an overscan buffer), so the number of mounted rows is
 * bounded by the viewport size — never by `itemCount`.
 *
 * Explicit bounds
 * ---------------
 * • Mounted rows  ≤ ceil(viewport / estimateSize) + 2 * overscan + 1,
 *   regardless of `itemCount`. Each rendered row is measured and its real
 *   height cached (bounded by the number of distinct rows ever rendered).
 * • Window computation is O(log n) per scroll event (binary search over a
 *   prefix array); the prefix array is rebuilt only when a measured size
 *   changes, never on scroll.
 * • No data is cached by this hook — it only windows the DOM. Callers keep
 *   rendering from their source-of-truth array, so virtualization can never
 *   serve stale or incorrect items.
 *
 * Keyboard continuity
 * -------------------
 * The window itself never widens beyond the viewport bound; callers that
 * need a row to stay mounted outside the window (e.g. the keyboard-focused
 * row) can render it separately at its exact offset via `getOffset`.
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type VirtualListRange = {
  /** First rendered item index (inclusive). */
  startIndex: number;
  /** Last rendered item index (inclusive); -1 when the list is empty. */
  endIndex: number;
  /** Offset in px of the first rendered item within the full list. */
  offset: number;
  /** Height in px of the rendered window (endIndex's bottom − offset). */
  windowSize: number;
  /** Total height in px of the full list. */
  totalSize: number;
};

export type ScrollAlign = 'auto' | 'start' | 'end' | 'center';

export type UseVirtualListOptions = {
  itemCount: number;
  /** Estimated default row height in px (used until a row is measured). */
  estimateSize: number;
  /** Extra rows rendered above/below the visible window. Default 4. */
  overscan?: number;
  /** The scroll container to attach to. */
  scrollElementRef: RefObject<HTMLElement | null>;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function useVirtualList({
  itemCount,
  estimateSize,
  overscan = 4,
  scrollElementRef,
}: UseVirtualListOptions): VirtualListRange & {
  viewportSize: number;
  scrollToIndex: (index: number, align?: ScrollAlign) => void;
  measure: (index: number, size: number) => void;
  /** Offset in px of an item's top edge within the full list. */
  getOffset: (index: number) => number;
} {
  const safeEstimate = Math.max(1, estimateSize);
  const safeOverscan = Math.max(0, overscan);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportSize, setViewportSize] = useState(0);
  /** Bumped whenever a measured size changes, to rebuild the prefix array. */
  const [measureVersion, setMeasureVersion] = useState(0);

  // Cached real heights keyed by item index (falls back to estimate).
  const sizesRef = useRef(new Map<number, number>());

  const readViewportSize = useCallback(() => {
    const el = scrollElementRef.current;
    if (el) setViewportSize((prev) => (prev === el.clientHeight ? prev : el.clientHeight));
  }, [scrollElementRef]);

  const measure = useCallback((index: number, size: number) => {
    if (!(size > 0) || index < 0) return;
    const sizes = sizesRef.current;
    const prev = sizes.get(index);
    if (prev === undefined || Math.abs(prev - size) > 1) {
      sizes.set(index, size);
      setMeasureVersion((v) => v + 1);
    }
  }, []);

  // Attach scroll / resize listeners to the scroll container.
  useLayoutEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;

    readViewportSize();

    const onScroll = () => {
      const next = el.scrollTop;
      setScrollTop((prev) => (prev === next ? prev : next));
      // Re-read the viewport on scroll too: it costs nothing, keeps the
      // hook correct after layout shifts, and lets tests drive the window
      // by defining clientHeight + dispatching a scroll event.
      readViewportSize();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', readViewportSize);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(readViewportSize);
      observer.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', readViewportSize);
      observer?.disconnect();
    };
  }, [scrollElementRef, readViewportSize]);

  // Prefix sums over measured sizes (estimate for unmeasured rows).
  // Rebuilt only when measurements change or itemCount changes.
  const prefix = useMemo(() => {
    const sizes = sizesRef.current;
    const arr = new Array<number>(itemCount + 1);
    arr[0] = 0;
    for (let i = 0; i < itemCount; i++) {
      arr[i + 1] = arr[i] + (sizes.get(i) ?? safeEstimate);
    }
    return arr;
  }, [measureVersion, itemCount, safeEstimate]);

  // Mirrors of computed values for imperative callbacks (no stale closures).
  const prefixRef = useRef(prefix);
  prefixRef.current = prefix;
  const viewportRef = useRef(viewportSize);
  viewportRef.current = viewportSize;

  const range = useMemo<VirtualListRange>(() => {
    if (itemCount <= 0) {
      return { startIndex: 0, endIndex: -1, offset: 0, windowSize: 0, totalSize: 0 };
    }

    const totalSize = prefix[itemCount];

    // First index whose top is at or below the scroll position.
    let start = lowerBound(prefix, scrollTop, itemCount);
    // Last index whose top is above the bottom of the viewport.
    let end = upperBound(prefix, scrollTop + viewportSize, itemCount) - 1;

    start = clamp(start - safeOverscan, 0, itemCount - 1);
    end = clamp(end + safeOverscan, 0, itemCount - 1);

    if (start > end) {
      start = 0;
      end = 0;
    }

    const offset = prefix[start];
    const windowSize = prefix[end + 1] - offset;
    return { startIndex: start, endIndex: end, offset, windowSize, totalSize };
  }, [itemCount, prefix, scrollTop, viewportSize, safeOverscan]);

  const getOffset = useCallback(
    (index: number): number => prefixRef.current[index] ?? index * safeEstimate,
    [safeEstimate],
  );

  const scrollToIndex = useCallback(
    (index: number, align: ScrollAlign = 'auto') => {
      const el = scrollElementRef.current;
      if (!el || itemCount <= 0) return;
      const target = clamp(index, 0, itemCount - 1);
      const prefixArr = prefixRef.current;
      const offset = prefixArr[target] ?? target * safeEstimate;
      const size = sizesRef.current.get(target) ?? safeEstimate;
      const viewport = viewportRef.current;

      let top = el.scrollTop;
      if (align === 'start') {
        top = offset;
      } else if (align === 'end') {
        top = offset + size - viewport;
      } else if (align === 'center') {
        top = offset - (viewport - size) / 2;
      } else {
        // 'auto' — only scroll if the item is outside the visible window.
        if (offset < top) top = offset;
        else if (offset + size > top + viewport) top = offset + size - viewport;
      }

      el.scrollTop = Math.max(0, top);
      // Some environments do not dispatch scroll events for programmatic
      // scrollTop writes, so sync state directly as well.
      setScrollTop(el.scrollTop);
      readViewportSize();
    },
    [itemCount, safeEstimate, scrollElementRef, readViewportSize],
  );

  return { ...range, viewportSize, scrollToIndex, measure, getOffset };
}

/** First index i in [0, count] where prefix[i] >= target. */
function lowerBound(prefix: number[], target: number, count: number): number {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index i in [0, count] where prefix[i] > target. */
function upperBound(prefix: number[], target: number, count: number): number {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
