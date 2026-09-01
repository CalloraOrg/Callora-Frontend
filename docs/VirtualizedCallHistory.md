# Virtualized Call-History Table

Issue #1006 — virtualize the API call-history table so it stays responsive
and bounded as the number of recorded calls grows, without losing keyboard
focus while the list scrolls or updates.

## What changed

- `src/hooks/useVirtualList.ts` — windowing hook. Given a scroll container,
  an item count, and an estimated row height, it returns the visible window
  (`startIndex`/`endIndex`), the window's pixel offset, the full list height,
  plus `scrollToIndex`, `measure` (for real rendered heights), and
  `getOffset` (exact item offsets).
- `src/components/VirtualizedCallHistory.tsx` — the table shell. Renders the
  sticky header, loading skeletons, the empty state, and only the rows in the
  virtual window (absolutely positioned at their measured offsets inside a
  full-height spacer). Owns roving-tabindex keyboard navigation.
- `src/pages/ApiUsage.tsx` — swaps the inline `.map()` of `CallHistoryRow`
  for `<VirtualizedCallHistory>`. No filter/export/expand behavior changed.
- `src/components/CallHistoryRow.tsx` — new optional `viewButtonTabIndex`
  prop so the table can implement roving tabindex.
- `src/index.css` — the table is now a bounded internal scroll container
  (`max-height: min(60vh, 640px)`, `overflow-y: auto`) with a sticky header.

## Bounds (explicit)

- Mounted rows ≤ `ceil(viewport / rowHeight) + 2 * overscan + 1`, regardless
  of item count — plus at most **one** extra pinned row holding keyboard
  focus when it is scrolled outside the window.
- Window computation is O(log n) per scroll event (binary search over a
  prefix array). The prefix array is rebuilt only when a measured row height
  changes, never on scroll.
- Measured heights are cached per index and bounded by the number of rows
  ever rendered; unmeasured rows use the 64px estimate.
- The full list height is an explicit spacer, so the scrollbar always
  reflects the true total.

## Keyboard continuity

Roving tabindex: only the active row's "View/Hide" button is in the tab
order. While focused in the list:

| Key         | Action                      |
| ----------- | --------------------------- |
| ArrowDown   | next row                    |
| ArrowUp     | previous row                |
| Home / End  | first / last row            |
| PageDown/Up | one viewport of rows        |

The focused row is scrolled into view on navigation. If the list scrolls
under it (pointer scroll) or updates (new calls prepended), the row stays
mounted — pinned at its exact offset and sharing the same React key as its
in-window copy, so focus never drops. Before anything is focused, the tab
stop follows the window's first row so Tab always lands on a visible row.

## Correctness under updates

Virtualization windows the DOM only; rows are always rendered from the
caller's `calls` array (the source of truth). There is no data cache, so
stale or incorrect rows cannot be served. Rows are keyed by window index,
so in-place data changes reuse the DOM node (matching non-virtualized
behavior where the focused element keeps showing the same screen position).

## Tests

- `src/hooks/useVirtualList.test.tsx` — window bounds, scroll-driven windows,
  measured heights, `getOffset`, `scrollToIndex` alignment, empty lists, and
  a worst-case sweep asserting the window stays bounded at every offset.
- `src/components/VirtualizedCallHistory.test.tsx` — bounded DOM for a
  10,000-row list, scroll window updates, roving tabindex, Arrow/Home/End/
  PageDown/PageUp navigation, focus survival under scroll-away and data
  prepends, no stale data on array replacement, 50 rapid updates, empty and
  loading states, and expand/collapse.

Run them with:

```bash
npm test -- --run src/hooks/useVirtualList.test.tsx src/components/VirtualizedCallHistory.test.tsx
```
