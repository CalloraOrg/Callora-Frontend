/**
 * useVirtualList — focused unit tests.
 *
 * jsdom has no layout, so the harness drives the hook the same way a browser
 * does: the scroll container's `clientHeight` and `scrollTop` are defined as
 * own properties and `scroll` events are dispatched; the hook reads them
 * exactly like real DOM scroll events.
 */

import { act, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useVirtualList } from './useVirtualList';

const ESTIMATE = 64;

type HarnessProps = {
  itemCount: number;
  estimateSize?: number;
  overscan?: number;
  /** Explicit heights measured for specific indices (all others use the estimate). */
  heights?: Record<number, number>;
};

function Harness({ itemCount, estimateSize = ESTIMATE, overscan, heights = {} }: HarnessProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const v = useVirtualList({
    itemCount,
    estimateSize,
    overscan,
    scrollElementRef: ref,
  });
  return (
    <div ref={ref} data-testid="scroller">
      <div data-testid="range">{`${v.startIndex}:${v.endIndex}`}</div>
      <div data-testid="offset">{v.offset}</div>
      <div data-testid="window">{v.windowSize}</div>
      <div data-testid="total">{v.totalSize}</div>
      <div data-testid="viewport">{v.viewportSize}</div>
      <div data-testid="offset-3">{v.getOffset(3)}</div>
      <button data-testid="goto-auto" onClick={() => v.scrollToIndex(100, 'auto')}>
        goto-auto
      </button>
      <button data-testid="goto-start" onClick={() => v.scrollToIndex(100, 'start')}>
        goto-start
      </button>
      {Array.from({ length: v.endIndex - v.startIndex + 1 }, (_, i) => {
        const index = v.startIndex + i;
        return (
          <div
            key={index}
            data-index={index}
            ref={(el) => {
              if (el) v.measure(index, heights[index] ?? estimateSize);
            }}
          />
        );
      })}
    </div>
  );
}

/** Give the scroll container a viewport and scroll position, then sync it. */
function driveScroll(el: HTMLElement, clientHeight: number, scrollTop = 0) {
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  act(() => {
    fireEvent.scroll(el);
  });
}

const textOf = (el: HTMLElement, testId: string) =>
  (el.querySelector(`[data-testid="${testId}"]`) as HTMLElement).textContent ?? '';

function renderHarness(props: HarnessProps) {
  const utils = render(
    <Harness
      itemCount={props.itemCount}
      estimateSize={props.estimateSize}
      overscan={props.overscan}
      heights={props.heights}
    />,
  );
  return { ...utils, scroller: utils.getByTestId('scroller') as HTMLDivElement };
}

describe('useVirtualList', () => {
  it('windows a huge list to a bounded slice (explicit bound)', () => {
    const { scroller } = renderHarness({ itemCount: 100_000 });
    driveScroll(scroller, 400);

    // viewport rows = ceil(400 / 64) = 7; overscan default 4 each side.
    expect(textOf(scroller, 'range')).toBe('0:10');
    expect(Number(textOf(scroller, 'total'))).toBe(100_000 * ESTIMATE);
    expect(Number(textOf(scroller, 'viewport'))).toBe(400);
  });

  it('moves the window when the container scrolls', () => {
    const { scroller } = renderHarness({ itemCount: 10_000 });
    driveScroll(scroller, 400, ESTIMATE * 100);

    // Rows 100 → 107 intersect the viewport; overscan widens each side.
    const [start, end] = textOf(scroller, 'range').split(':').map(Number);
    expect(start).toBe(96);
    expect(end).toBe(110);
    expect(Number(textOf(scroller, 'offset'))).toBe(96 * ESTIMATE);
  });

  it('reports the correct total when rows are measured at different heights', () => {
    const { scroller } = renderHarness({ itemCount: 10, heights: { 2: 200 } });
    driveScroll(scroller, 400);

    // Row 2 measured at 200px instead of the 64px estimate.
    expect(Number(textOf(scroller, 'total'))).toBe(9 * ESTIMATE + 200);
  });

  it('exposes getOffset for exact item offsets (pinning support)', () => {
    const { scroller } = renderHarness({ itemCount: 10, heights: { 2: 200 } });
    driveScroll(scroller, 400);

    // prefix: [0, 64, 128, 328, 392, ...] — row 3 starts after measured row 2.
    expect(textOf(scroller, 'offset-3')).toBe(String(3 * ESTIMATE + (200 - ESTIMATE)));
  });

  it('scrollToIndex with align=auto scrolls the item into view', () => {
    const { scroller } = renderHarness({ itemCount: 10_000 });
    driveScroll(scroller, 400, 0);

    fireEvent.click(scroller.querySelector('[data-testid="goto-auto"]') as HTMLElement);

    // Item 100 starts at 6400; auto-scroll puts its bottom at the viewport bottom.
    expect(scroller.scrollTop).toBe(ESTIMATE * 100 + ESTIMATE - 400);
    const [start, end] = textOf(scroller, 'range').split(':').map(Number);
    expect(start).toBeLessThanOrEqual(100);
    expect(end).toBeGreaterThanOrEqual(100);
  });

  it('scrollToIndex with align=start jumps to the item top', () => {
    const { scroller } = renderHarness({ itemCount: 10_000 });
    driveScroll(scroller, 400, 0);

    fireEvent.click(scroller.querySelector('[data-testid="goto-start"]') as HTMLElement);

    expect(scroller.scrollTop).toBe(ESTIMATE * 100);
  });

  it('returns an empty range for an empty list', () => {
    const { scroller } = renderHarness({ itemCount: 0 });
    driveScroll(scroller, 400);

    expect(textOf(scroller, 'range')).toBe('0:-1');
    expect(Number(textOf(scroller, 'total'))).toBe(0);
  });

  it('keeps the rendered window bounded while scrolling through a huge list', () => {
    const { scroller } = renderHarness({ itemCount: 100_000, overscan: 5 });
    driveScroll(scroller, 400);

    const maxRows = Math.ceil(400 / ESTIMATE) + 2 * 5 + 1;
    const countRange = () => {
      const [start, end] = textOf(scroller, 'range').split(':').map(Number);
      return end - start + 1;
    };
    expect(countRange()).toBeLessThanOrEqual(maxRows);

    // Sweep the whole list: the window must stay bounded at every offset.
    for (const top of [0, 4000, 64_000, 640_000, 6_400_000]) {
      driveScroll(scroller, 400, top);
      expect(countRange()).toBeLessThanOrEqual(maxRows);
    }
  });
});
