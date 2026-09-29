/**
 * VirtualizedCallHistory — component tests.
 *
 * jsdom has no layout, so tests define the scroll container's `clientHeight`
 * and `scrollTop` as own properties and dispatch scroll events; row heights
 * default to the 64px estimate (jsdom reports offsetHeight 0 and the hook
 * skips those measurements). All assertions are on DOM structure, focus,
 * and data — never on pixel layout.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import VirtualizedCallHistory from './VirtualizedCallHistory';
import type { CallRecord } from './CallHistoryRow';

const ROW = 64; // matches the default estimateRowHeight
const VIEWPORT = 400;
const OVERSCAN = 5;

function makeCalls(count: number, prefix = 'v1'): CallRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-call-${i}`,
    timestamp: new Date(2026, 0, 1, 12, 0, i),
    endpoint: `/api/${prefix}/endpoint/${i}`,
    status: (i % 2 === 0 ? 'success' : 'error') as 'success' | 'error',
    responseTime: 100 + i,
    cost: 0.001 + i / 1000,
  }));
}

/** Simulate a browser scroll: set the container's viewport and position. */
function driveTable(container: HTMLElement, clientHeight: number, scrollTop = 0) {
  const el = container.querySelector('.call-history-table') as HTMLElement;
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  act(() => {
    fireEvent.scroll(el);
  });
  return el;
}

function renderTable(props: { calls: CallRecord[]; isLoading?: boolean; expandedCallId?: string | null }) {
  const utils = render(
    <VirtualizedCallHistory
      calls={props.calls}
      isLoading={props.isLoading}
      expandedCallId={props.expandedCallId}
      onToggleExpand={() => {}}
    />,
  );
  return { ...utils, table: utils.container.querySelector('.call-history-table') as HTMLElement };
}

function StatefulTable({ calls }: { calls: CallRecord[] }) {
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  return (
    <VirtualizedCallHistory
      calls={calls}
      expandedCallId={expandedCallId}
      onToggleExpand={(id) => setExpandedCallId((prev) => (prev === id ? null : id))}
    />
  );
}

const rowButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('.call-history-table__item button'));

const activeRowIndex = () =>
  document.activeElement?.closest('[data-row-index]')?.getAttribute('data-row-index') ?? null;

/** Focus a button inside act() so React flushes the roving-tabindex sync. */
const focusRow = (button: HTMLElement) => {
  act(() => {
    button.focus();
  });
};

const MAX_WINDOW_ROWS = Math.ceil(VIEWPORT / ROW) + 2 * OVERSCAN + 1; // 18

describe('VirtualizedCallHistory', () => {
  it('mounts only a bounded slice of a 10,000-row list', () => {
    const { container } = renderTable({ calls: makeCalls(10_000) });
    driveTable(container, VIEWPORT);

    const items = container.querySelectorAll('.call-history-table__item');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(MAX_WINDOW_ROWS);
    expect(screen.getByText('/api/v1/endpoint/0')).toBeTruthy();
    expect(screen.queryByText('/api/v1/endpoint/9999')).toBeNull();
  });

  it('moves the mounted window when the container scrolls', () => {
    const { container } = renderTable({ calls: makeCalls(10_000) });
    driveTable(container, VIEWPORT, 500 * ROW);

    expect(screen.getByText('/api/v1/endpoint/500')).toBeTruthy();
    expect(screen.queryByText('/api/v1/endpoint/0')).toBeNull();
    expect(container.querySelectorAll('.call-history-table__item').length).toBeLessThanOrEqual(
      MAX_WINDOW_ROWS,
    );
  });

  it('sizes the viewport spacer to the full list height', () => {
    const { container } = renderTable({ calls: makeCalls(1_000) });
    driveTable(container, VIEWPORT, 100 * ROW);

    const viewport = container.querySelector('.call-history-table__viewport') as HTMLElement;
    expect(viewport.style.height).toBe(`${ROW * 1_000}px`);
    // First mounted row is the overscan-adjusted window start.
    const firstItem = container.querySelector('.call-history-table__item') as HTMLElement;
    expect(firstItem.getAttribute('data-row-index')).toBe('95');
  });

  it('keeps exactly one row button in the tab order (roving tabindex)', () => {
    const { container } = renderTable({ calls: makeCalls(100) });
    driveTable(container, VIEWPORT);

    const tabbable = rowButtons(container).filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.closest('[data-row-index]')?.getAttribute('data-row-index')).toBe('0');
    // Non-active buttons are skipped by Tab.
    rowButtons(container)
      .filter((b) => b.tabIndex === 0)
      .forEach((b) => expect(b.tabIndex).toBe(0));
    rowButtons(container)
      .filter((b) => b.tabIndex !== 0)
      .forEach((b) => expect(b.tabIndex).toBe(-1));
  });

  it('ArrowDown moves focus to the next row', () => {
    const { container } = renderTable({ calls: makeCalls(1_000) });
    driveTable(container, VIEWPORT);

    focusRow(rowButtons(container)[0]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(activeRowIndex()).toBe('1');

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(activeRowIndex()).toBe('2');
  });

  it('End jumps focus to the last row and scrolls it into view', () => {
    const { container } = renderTable({ calls: makeCalls(1_000) });
    const table = driveTable(container, VIEWPORT);

    focusRow(rowButtons(container)[0]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });

    expect(activeRowIndex()).toBe('999');
    expect(table.scrollTop).toBe(ROW * 1_000 - VIEWPORT);
    expect(container.querySelector('[data-row-index="999"]')).toBeTruthy();
  });

  it('Home jumps focus back to the first row', () => {
    const { container } = renderTable({ calls: makeCalls(1_000) });
    const table = driveTable(container, VIEWPORT);

    focusRow(rowButtons(container)[0]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });

    expect(activeRowIndex()).toBe('0');
    expect(table.scrollTop).toBe(0);
  });

  it('PageDown advances by one viewport of rows', () => {
    const { container } = renderTable({ calls: makeCalls(1_000) });
    driveTable(container, VIEWPORT); // pageSize = floor(400 / 64) = 6

    focusRow(rowButtons(container)[0]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'PageDown' });
    expect(activeRowIndex()).toBe('6');

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'PageUp' });
    expect(activeRowIndex()).toBe('0');
  });

  it('keeps keyboard focus when the list scrolls under the focused row', () => {
    const { container } = renderTable({ calls: makeCalls(10_000) });
    driveTable(container, VIEWPORT);

    focusRow(rowButtons(container)[2]);
    expect(activeRowIndex()).toBe('2');

    // Pointer/scrollbar scroll far away while row 2 is focused.
    driveTable(container, VIEWPORT, 5_000 * ROW);

    // Focus survives: the row is pinned, and the window stays bounded.
    expect(activeRowIndex()).toBe('2');
    expect(container.querySelector('[data-row-index="2"]')).toBeTruthy();
    expect(container.querySelectorAll('.call-history-table__item').length).toBeLessThanOrEqual(
      MAX_WINDOW_ROWS + 1, // window + pinned focused row
    );
  });

  it('keeps focus on the same row when new calls are prepended (no stale rows)', () => {
    const initial = makeCalls(100, 'v1');
    const { container, rerender } = renderTable({ calls: initial });
    driveTable(container, VIEWPORT);

    focusRow(rowButtons(container)[5]);
    const updated = [...makeCalls(100, 'v2'), ...initial];
    rerender(<VirtualizedCallHistory calls={updated} onToggleExpand={() => {}} />);

    expect(activeRowIndex()).toBe('5');
    const row5 = container.querySelector('[data-row-index="5"]');
    expect(row5?.textContent).toContain('/api/v2/endpoint/5');
  });

  it('renders fresh data when the calls array is replaced (no stale data)', () => {
    const { container, rerender } = renderTable({ calls: makeCalls(50, 'v1') });
    driveTable(container, VIEWPORT);
    expect(screen.getByText('/api/v1/endpoint/0')).toBeTruthy();

    rerender(<VirtualizedCallHistory calls={makeCalls(50, 'v3')} onToggleExpand={() => {}} />);
    expect(screen.getByText('/api/v3/endpoint/0')).toBeTruthy();
    expect(screen.queryByText('/api/v1/endpoint/0')).toBeNull();
  });

  it('stays bounded across many rapid data updates', () => {
    const { container, rerender } = renderTable({ calls: makeCalls(5_000) });
    driveTable(container, VIEWPORT);

    for (let i = 0; i < 50; i++) {
      rerender(<VirtualizedCallHistory calls={makeCalls(5_000, `v${i}`)} onToggleExpand={() => {}} />);
    }

    expect(container.querySelectorAll('.call-history-table__item').length).toBeLessThanOrEqual(
      MAX_WINDOW_ROWS,
    );
  });

  it('shows the empty state when there are no calls', () => {
    const { container } = renderTable({ calls: [] });
    expect(screen.getByText('No call records match the selected filter.')).toBeTruthy();
    expect(container.querySelectorAll('.call-history-table__item').length).toBe(0);
  });

  it('shows skeleton rows while loading and no live rows', () => {
    const { container } = renderTable({ calls: makeCalls(100), isLoading: true });
    expect(container.querySelectorAll('.table-row').length).toBe(5);
    expect(container.querySelectorAll('.call-history-table__item').length).toBe(0);
  });

  it('expands a row on click while keeping the window bounded', () => {
    const { container } = render(<StatefulTable calls={makeCalls(1_000)} />);
    driveTable(container, VIEWPORT);

    const first = rowButtons(container)[0];
    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.expanded-details')).toBeTruthy();
    expect(container.querySelectorAll('.call-history-table__item').length).toBeLessThanOrEqual(
      MAX_WINDOW_ROWS,
    );

    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });
});
