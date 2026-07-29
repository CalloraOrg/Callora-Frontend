// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CallsHeatmap from './CallsHeatmap';

// The component derives its grid from `new Date()` and fills counts with
// `Math.random()`. Both are stubbed here so every assertion is deterministic:
//   • system time is pinned so the future-cell boundary is fixed,
//   • Math.random is pinned so counts / intensity levels are predictable.

const COLS = 13;
const ROWS = 7;
const TOTAL_CELLS = COLS * ROWS; // 91 days (13 weeks)

/** A Saturday — `getDay() === 6` — so the current week has **no** future days. */
const SATURDAY = new Date(2024, 0, 6, 12, 0, 0);
/** A Wednesday — `getDay() === 3` — so Thu/Fri/Sat of the week are future. */
const WEDNESDAY = new Date(2024, 0, 3, 12, 0, 0);

function pinDate(date: Date) {
  // Only fake `Date`; leave real timers/microtasks so React renders normally.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

function focusableCells(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('.heatmap-cell[tabindex="0"]'),
  );
}

describe('CallsHeatmap', () => {
  beforeEach(() => {
    // Default: mid-intensity, deterministic count = floor(0.5 * 5000) = 2500.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Structure & ARIA ──────────────────────────────────────────────────────

  it('renders an accessible grid with a descriptive label', () => {
    pinDate(SATURDAY);
    render(<CallsHeatmap />);
    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('aria-label')).toBe('API Calls Heatmap');
  });

  it('lays out 13 week columns as rows', () => {
    pinDate(SATURDAY);
    render(<CallsHeatmap />);
    expect(screen.getAllByRole('row')).toHaveLength(COLS);
  });

  it('renders all 91 days as gridcells when the week has no future days', () => {
    pinDate(SATURDAY);
    render(<CallsHeatmap />);
    // aria-hidden future cells are excluded by role queries; on a Saturday
    // there are none, so every one of the 91 days is an accessible gridcell.
    expect(screen.getAllByRole('gridcell')).toHaveLength(TOTAL_CELLS);
  });

  it('gives every past/today cell a focusable tabstop, id, and dated label', () => {
    pinDate(SATURDAY);
    const { container } = render(<CallsHeatmap />);
    const cells = focusableCells(container);
    expect(cells).toHaveLength(TOTAL_CELLS);
    for (const cell of cells) {
      expect(cell.id).toMatch(/^heatmap-cell-\d+-\d+$/);
      expect(cell.getAttribute('aria-label')).toMatch(/: \d+ calls$/);
      expect(cell.hasAttribute('title')).toBe(true);
    }
  });

  // ── Future-day handling ───────────────────────────────────────────────────

  it('renders future days as aria-hidden, non-focusable cells', () => {
    pinDate(WEDNESDAY); // Wed → Thu, Fri, Sat are future = 3 days
    const { container } = render(<CallsHeatmap />);

    const futureCells = container.querySelectorAll('.future-cell');
    expect(futureCells).toHaveLength(3);
    futureCells.forEach((cell) => {
      expect(cell.getAttribute('aria-hidden')).toBe('true');
      expect(cell.hasAttribute('tabindex')).toBe(false);
      expect(cell.id).toBe('');
    });

    // The remaining 88 days stay focusable.
    expect(focusableCells(container)).toHaveLength(TOTAL_CELLS - 3);
  });

  // ── Intensity levels ──────────────────────────────────────────────────────

  it('maps a zero count to level-0 with a "0 calls" label', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // count = 0
    pinDate(SATURDAY);
    const { container } = render(<CallsHeatmap />);
    const cells = focusableCells(container);
    for (const cell of cells) {
      expect(cell.className).toContain('level-0');
      expect(cell.getAttribute('aria-label')).toMatch(/: 0 calls$/);
    }
  });

  it('maps a high count to the top intensity level-4', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // count = 4950 > 4000
    pinDate(SATURDAY);
    const { container } = render(<CallsHeatmap />);
    const cells = focusableCells(container);
    for (const cell of cells) {
      expect(cell.className).toContain('level-4');
      expect(cell.getAttribute('aria-label')).toMatch(/: 4950 calls$/);
    }
  });

  // ── Supporting chrome: weekdays, legend, months ───────────────────────────

  it('renders weekday labels inside an aria-hidden column', () => {
    pinDate(SATURDAY);
    const { container } = render(<CallsHeatmap />);
    const weekdays = container.querySelector('.heatmap-weekdays');
    expect(weekdays?.getAttribute('aria-hidden')).toBe('true');
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(within(weekdays as HTMLElement).getByText(day)).toBeTruthy();
    }
  });

  it('renders a Less→More legend with all five intensity swatches', () => {
    pinDate(SATURDAY);
    const { container } = render(<CallsHeatmap />);
    const legend = container.querySelector('.heatmap-legend');
    expect(legend?.getAttribute('aria-hidden')).toBe('true');
    expect(within(legend as HTMLElement).getByText('Less')).toBeTruthy();
    expect(within(legend as HTMLElement).getByText('More')).toBeTruthy();
    for (let level = 0; level <= 4; level++) {
      expect(legend!.querySelector(`.level-${level}`)).toBeTruthy();
    }
  });

  it('renders month labels spanning the ~3-month window', () => {
    pinDate(SATURDAY);
    const { container } = render(<CallsHeatmap />);
    // Oct 2023 → Jan 2024 window yields several distinct month headings.
    const monthLabels = container.querySelectorAll('.month-label');
    expect(monthLabels.length).toBeGreaterThanOrEqual(3);
  });

  // ── Keyboard navigation (roving focus) ────────────────────────────────────

  it('moves focus with the arrow keys across columns and rows', () => {
    pinDate(SATURDAY); // no future cells → every neighbour exists
    render(<CallsHeatmap />);

    const start = document.getElementById('heatmap-cell-0-0')!;
    start.focus();
    expect(document.activeElement).toBe(start);

    fireEvent.keyDown(start, { key: 'ArrowRight' });
    expect(document.activeElement?.id).toBe('heatmap-cell-1-0');

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement?.id).toBe('heatmap-cell-1-1');

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement?.id).toBe('heatmap-cell-0-1');

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement?.id).toBe('heatmap-cell-0-0');
  });

  it('clamps at the top-left corner without moving focus', () => {
    pinDate(SATURDAY);
    render(<CallsHeatmap />);
    const corner = document.getElementById('heatmap-cell-0-0')!;
    corner.focus();

    fireEvent.keyDown(corner, { key: 'ArrowLeft' });
    expect(document.activeElement?.id).toBe('heatmap-cell-0-0');
    fireEvent.keyDown(corner, { key: 'ArrowUp' });
    expect(document.activeElement?.id).toBe('heatmap-cell-0-0');
  });

  it('clamps at the bottom-right corner without moving focus', () => {
    pinDate(SATURDAY);
    render(<CallsHeatmap />);
    const corner = document.getElementById(`heatmap-cell-${COLS - 1}-${ROWS - 1}`)!;
    corner.focus();

    fireEvent.keyDown(corner, { key: 'ArrowRight' });
    expect(document.activeElement?.id).toBe(`heatmap-cell-${COLS - 1}-${ROWS - 1}`);
    fireEvent.keyDown(corner, { key: 'ArrowDown' });
    expect(document.activeElement?.id).toBe(`heatmap-cell-${COLS - 1}-${ROWS - 1}`);
  });

  it('ignores non-arrow keys', () => {
    pinDate(SATURDAY);
    render(<CallsHeatmap />);
    const cell = document.getElementById('heatmap-cell-2-2')!;
    cell.focus();
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(document.activeElement?.id).toBe('heatmap-cell-2-2');
  });
});
