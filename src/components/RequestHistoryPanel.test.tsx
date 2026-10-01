// @vitest-environment jsdom
/**
 * RequestHistoryPanel.test.tsx
 *
 * Unit tests for the request-history side panel.
 *
 * Coverage:
 *  - formatTime buckets: "Just now", "Nm ago", "Nh ago", and locale date,
 *    including the boundary values between buckets and clock-skew safety
 *    (a timestamp in the future must not produce a negative relative label).
 *  - Selecting an entry invokes onSelect with that exact entry.
 *  - "Clear all" invokes onClear.
 *  - An empty list renders the EmptyState.
 *  - The Escape key closes the panel only while it is open, the listener is
 *    removed on close/unmount, and unrelated keys are ignored.
 *
 * Time is frozen with vi.setSystemTime so relative labels are deterministic.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RequestHistoryPanel from "./RequestHistoryPanel";
import type { HistoryEntry } from "../state/testCallHistory";

// ── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-15T12:00:00.000Z");

/** ISO timestamp for `ms` milliseconds before the frozen "now". */
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "e1",
    timestamp: NOW.toISOString(),
    endpointId: "ep1",
    endpointName: "Ping",
    endpointPath: "/api/v1/ping",
    method: "GET",
    requestParams: "{}",
    response: { ok: true },
    status: "success",
    responseTime: 120,
    cost: 0,
    ...overrides,
  };
}

type PanelProps = React.ComponentProps<typeof RequestHistoryPanel>;

function renderPanel(props: Partial<PanelProps> = {}) {
  return render(
    <RequestHistoryPanel
      entries={[]}
      isOpen={false}
      onClose={vi.fn()}
      onSelect={vi.fn()}
      onClear={vi.fn()}
      {...props}
    />,
  );
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe("RequestHistoryPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ── formatTime: relative buckets ──────────────────────────────────────────

  describe("formatTime", () => {
    it("renders an entry 30s old as 'Just now'", () => {
      renderPanel({ entries: [makeEntry({ timestamp: ago(30 * SECOND) })] });
      expect(screen.getByText("Just now")).toBeTruthy();
    });

    it("renders an entry 5h old as '5h ago'", () => {
      renderPanel({ entries: [makeEntry({ timestamp: ago(5 * HOUR) })] });
      expect(screen.getByText("5h ago")).toBeTruthy();
    });

    it("renders minute-grained labels for sub-hour ages", () => {
      renderPanel({
        entries: [
          makeEntry({ id: "e1", timestamp: ago(5 * MINUTE) }),
          makeEntry({ id: "e2", timestamp: ago(59 * MINUTE) }),
        ],
      });
      expect(screen.getByText("5m ago")).toBeTruthy();
      expect(screen.getByText("59m ago")).toBeTruthy();
    });

    it("renders hour-grained labels for sub-day ages", () => {
      renderPanel({
        entries: [
          makeEntry({ id: "e1", timestamp: ago(HOUR) }),
          makeEntry({ id: "e2", timestamp: ago(23 * HOUR) }),
        ],
      });
      expect(screen.getByText("1h ago")).toBeTruthy();
      expect(screen.getByText("23h ago")).toBeTruthy();
    });

    it("treats sub-minute ages as 'Just now'", () => {
      renderPanel({
        entries: [
          makeEntry({ id: "e1", timestamp: NOW.toISOString() }),
          makeEntry({ id: "e2", timestamp: ago(59 * SECOND) }),
        ],
      });
      expect(screen.getAllByText("Just now")).toHaveLength(2);
    });

    it("renders a locale date (not a relative label) for ages of 24h or more", () => {
      const timestamp = ago(25 * HOUR);
      renderPanel({ entries: [makeEntry({ timestamp })] });

      const expected = new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(screen.getByText(expected)).toBeTruthy();
      expect(screen.queryByText(/ago/)).toBeNull();
    });

    it("does not emit a negative relative label for future timestamps (clock skew)", () => {
      const timestamp = ago(-5 * MINUTE);
      renderPanel({ entries: [makeEntry({ timestamp })] });
      expect(screen.getByText("Just now")).toBeTruthy();
      expect(screen.queryByText(/-/)).toBeNull();
    });
  });

  // ── Entry interaction ─────────────────────────────────────────────────────

  describe("entry interaction", () => {
    it("calls onSelect with the clicked entry", () => {
      const entry = makeEntry({ endpointPath: "/api/v1/widgets" });
      const onSelect = vi.fn();
      renderPanel({ entries: [entry], isOpen: true, onSelect });

      const item = screen.getAllByRole("button", {
        name: /\/api\/v1\/widgets/,
      })[0];
      fireEvent.click(item);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(entry);
    });

    it("calls onClear when 'Clear all' is clicked", () => {
      const onClear = vi.fn();
      renderPanel({ entries: [makeEntry()], isOpen: true, onClear });

      fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0]);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("does not render the toolbar or 'Clear all' when there are no entries", () => {
      renderPanel({ entries: [], isOpen: true, onClear: vi.fn() });
      expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("renders the EmptyState when there are no entries", () => {
      renderPanel({ entries: [] });
      expect(screen.getAllByTestId("empty-state-empty").length).toBeGreaterThan(
        0,
      );
      expect(screen.getAllByText("No requests yet").length).toBeGreaterThan(0);
    });

    it("does not render the EmptyState when entries exist", () => {
      renderPanel({ entries: [makeEntry()] });
      expect(screen.queryByTestId("empty-state-empty")).toBeNull();
    });
  });

  // ── Escape handling ───────────────────────────────────────────────────────

  describe("Escape handling", () => {
    it("calls onClose on Escape while open", () => {
      const onClose = vi.fn();
      renderPanel({ entries: [], isOpen: true, onClose });

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("ignores Escape while closed", () => {
      const onClose = vi.fn();
      renderPanel({ entries: [], isOpen: false, onClose });

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("stops listening after the panel closes", () => {
      const onClose = vi.fn();
      const { rerender } = renderPanel({
        entries: [],
        isOpen: true,
        onClose,
      });

      rerender(
        <RequestHistoryPanel
          entries={[]}
          isOpen={false}
          onClose={onClose}
          onSelect={vi.fn()}
          onClear={vi.fn()}
        />,
      );
      fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("removes the keydown listener on unmount", () => {
      const onClose = vi.fn();
      const { unmount } = renderPanel({ entries: [], isOpen: true, onClose });

      unmount();
      fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("ignores non-Escape keys", () => {
      const onClose = vi.fn();
      renderPanel({ entries: [], isOpen: true, onClose });

      fireEvent.keyDown(window, { key: "Enter" });
      fireEvent.keyDown(window, { key: "a" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
