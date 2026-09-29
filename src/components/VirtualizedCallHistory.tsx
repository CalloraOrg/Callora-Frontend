/**
 * VirtualizedCallHistory — the API call-history table, virtualized.
 *
 * Only the rows intersecting the scroll container's viewport (plus an
 * overscan buffer) are mounted, so the DOM stays bounded no matter how
 * many calls exist. Rows are rendered straight from the `calls` array
 * (the caller's source of truth) — virtualization never caches call data,
 * so it cannot serve stale or incorrect rows.
 *
 * Bounds
 * ------
 * Mounted rows ≤ ceil(viewport / rowHeight) + 2 * overscan + 1, plus at
 * most one extra pinned row holding keyboard focus when it is scrolled out
 * of the window. The total content height is an explicit spacer so the
 * scrollbar reflects the full list.
 *
 * Keyboard continuity (roving tabindex)
 * -------------------------------------
 * Only one row's "View/Hide" button is in the tab order at a time. While
 * focused inside the list:
 *   ArrowDown / ArrowUp   → next / previous row
 *   Home / End            → first / last row
 *   PageDown / PageUp     → one viewport's worth of rows
 * The focused row is always scrolled into view; if the list scrolls or
 * updates under it (pointer scroll, new calls arriving), the row is kept
 * mounted — pinned at its exact offset — so keyboard focus is never lost.
 * Until the user focuses a row, the tab stop follows the window's first row
 * (so Tab always lands somewhere visible); pinning only engages once a row
 * actually holds focus.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import CallHistoryRow from './CallHistoryRow';
import type { CallRecord } from './CallHistoryRow';
import EmptyState from './EmptyState';
import { SkeletonRow } from './Skeleton';
import { useVirtualList } from '../hooks/useVirtualList';

const DEFAULT_ROW_HEIGHT = 64; // collapsed row height estimate (px)
const DEFAULT_OVERSCAN = 5;

export type VirtualizedCallHistoryProps = {
  /** Source-of-truth rows, already filtered/sorted by the caller. */
  calls: CallRecord[];
  /** Renders skeleton rows instead of the list while true. */
  isLoading?: boolean;
  /** id of the expanded call (if any) — controlled by the caller. */
  expandedCallId?: string | null;
  onToggleExpand: (id: string) => void;
  /** Estimated collapsed row height in px. Default 64. */
  estimateRowHeight?: number;
  /** Extra rows rendered above/below the visible window. Default 5. */
  overscan?: number;
};

export default function VirtualizedCallHistory({
  calls,
  isLoading = false,
  expandedCallId = null,
  onToggleExpand,
  estimateRowHeight = DEFAULT_ROW_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
}: VirtualizedCallHistoryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The row that holds keyboard focus (null = nothing focused yet).
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const pendingFocusRef = useRef(false);

  const itemCount = calls.length;

  const { startIndex, endIndex, offset, totalSize, viewportSize, scrollToIndex, measure, getOffset } =
    useVirtualList({
      itemCount,
      estimateSize: estimateRowHeight,
      overscan,
      scrollElementRef: containerRef,
    });

  // Keep the active index valid when the list shrinks (filters, clears).
  useEffect(() => {
    setActiveIndex((prev) =>
      prev === null || prev <= itemCount - 1 ? prev : Math.max(itemCount - 1, 0),
    );
  }, [itemCount]);

  // The row that owns the tab stop: the focused row, or — before anything
  // is focused — the first row of the current window.
  const tabbableIndex = activeIndex ?? startIndex;
  const pageSize = Math.max(1, Math.floor(viewportSize / Math.max(1, estimateRowHeight)));

  const focusRowButton = useCallback((index: number) => {
    const button = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-row-index="${index}"] .table-row button`,
    );
    button?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (itemCount === 0 || event.defaultPrevented) return;
    const from = tabbableIndex;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(from + 1, itemCount - 1);
        break;
      case 'ArrowUp':
        next = Math.max(from - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = itemCount - 1;
        break;
      case 'PageDown':
        next = Math.min(from + pageSize, itemCount - 1);
        break;
      case 'PageUp':
        next = Math.max(from - pageSize, 0);
        break;
      default:
        return;
    }
    if (next === from) return;
    event.preventDefault();
    pendingFocusRef.current = true;
    setActiveIndex(next);
    scrollToIndex(next, 'auto');
  };

  // Move DOM focus to the newly active row after the re-render. The active
  // row is always mounted (in the window, or pinned), so the button exists.
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    if (activeIndex !== null) focusRowButton(activeIndex);
  }, [activeIndex, focusRowButton]);

  const hasRows = itemCount > 0;
  // When the focused row scrolls out of the window (pointer scroll or data
  // shifts), keep it mounted — pinned at its exact offset — so keyboard
  // focus survives. It is the same key as the in-window row, so React reuses
  // the DOM node (and focus) when the row re-enters the window. Only engages
  // once a row actually holds focus (activeIndex !== null). The index is
  // also guarded against shrink-renders where the clamp effect has not run
  // yet (activeIndex can still exceed itemCount for one frame).
  const pinnedIndex =
    hasRows &&
    activeIndex !== null &&
    activeIndex < itemCount &&
    (activeIndex < startIndex || activeIndex > endIndex)
      ? activeIndex
      : null;

  // One flat, keyed list (pinned row + window rows) so React *moves* the
  // active row's DOM node when it transitions between pinned and in-window
  // instead of remounting it (a remount would drop keyboard focus).
  const renderedRows = useMemo(() => {
    const rows: { index: number; pinned: boolean }[] = [];
    if (pinnedIndex !== null) rows.push({ index: pinnedIndex, pinned: true });
    for (let i = startIndex; i <= endIndex; i++) rows.push({ index: i, pinned: false });
    return rows;
  }, [pinnedIndex, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      className="call-history-table"
      onKeyDown={handleKeyDown}
      aria-label="Call history"
      aria-busy={isLoading}
    >
      <div className="table-header">
        <span>Timestamp</span>
        <span>Endpoint</span>
        <span>Status</span>
        <span>Response Time</span>
        <span>Cost</span>
        <span>Actions</span>
      </div>

      {isLoading ? (
        <SkeletonRow rows={5} />
      ) : !hasRows ? (
        <EmptyState message="No call records match the selected filter." />
      ) : (
        <div
          className="call-history-table__viewport"
          role="list"
          aria-label="Call history rows"
          style={{ height: totalSize }}
        >
          {renderedRows.map(({ index, pinned }) => {
            const call = calls[index];
            if (!call) return null; // shrink-render guard (clamp effect runs after render)
            return (
              <CallRow
                key={index}
                index={index}
                call={call}
                isActive={index === tabbableIndex}
                expandedCallId={expandedCallId}
                onToggleExpand={onToggleExpand}
                onActivate={() => setActiveIndex(index)}
                pinned={pinned}
                measure={measure}
                top={getOffset(index) - offset}
                ariaSetsize={itemCount}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A single windowed (or pinned) row, absolutely positioned inside the viewport. */
function CallRow({
  index,
  call,
  isActive,
  expandedCallId,
  onToggleExpand,
  onActivate,
  measure,
  top,
  ariaSetsize,
  pinned = false,
}: {
  index: number;
  call: CallRecord;
  isActive: boolean;
  expandedCallId: string | null;
  onToggleExpand: (id: string) => void;
  /** Called when any element inside the row receives focus (roving tabindex sync). */
  onActivate: () => void;
  measure: (index: number, size: number) => void;
  top: number;
  ariaSetsize: number;
  pinned?: boolean;
}) {
  return (
    <div
      className={`call-history-table__item${pinned ? ' call-history-table__item--pinned' : ''}`}
      role="listitem"
      aria-posinset={index + 1}
      aria-setsize={ariaSetsize}
      data-row-index={index}
      style={{ top }}
      onFocusCapture={onActivate}
      ref={(el) => {
        // Measure real rendered heights (jsdom returns 0 and is skipped).
        if (el) measure(index, el.offsetHeight);
      }}
    >
      <CallHistoryRow
        call={call}
        expanded={expandedCallId === call.id}
        onToggleExpand={onToggleExpand}
        viewButtonTabIndex={isActive ? 0 : -1}
      />
    </div>
  );
}
