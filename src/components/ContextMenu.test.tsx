import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextMenu } from "./ContextMenu";
import type { ContextMenuAction } from "./ContextMenu";

// ─── Viewport helpers ────────────────────────────────────────────────────────

/** Mirrors the constants used by the component for pre-render clamping. */
const MENU_WIDTH = 192;
const MENU_HEIGHT_PER_ITEM = 40;
const EDGE_MARGIN = 8;

const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
}

/** Fresh actions with per-test spies so assertions cannot leak between cases. */
function makeActions(): ContextMenuAction[] {
  return [
    { label: "Copy URL", action: vi.fn() },
    { label: "Open in New Tab", action: vi.fn() },
    { label: "Remove", action: vi.fn(), isCritical: true },
  ];
}

function estimatedHeight(actionCount: number): number {
  return actionCount * MENU_HEIGHT_PER_ITEM + 8;
}

describe("ContextMenu", () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    setViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Viewport-edge clamping ────────────────────────────────────────────────

  describe("viewport-edge clamping", () => {
    it("clamps a menu requested beyond the right edge inside the viewport", () => {
      const actions = makeActions();
      const { container } = render(
        <ContextMenu x={VIEWPORT_WIDTH + 100} y={100} onClose={onClose} actions={actions} />,
      );

      const menu = container.firstChild as HTMLElement;
      const left = parseFloat(menu.style.left);
      expect(left).toBeLessThanOrEqual(VIEWPORT_WIDTH - MENU_WIDTH - EDGE_MARGIN);
      expect(left).toBe(VIEWPORT_WIDTH - MENU_WIDTH - EDGE_MARGIN);
    });

    it("clamps a menu requested beyond the left edge inside the viewport", () => {
      const actions = makeActions();
      const { container } = render(
        <ContextMenu x={-500} y={100} onClose={onClose} actions={actions} />,
      );

      const menu = container.firstChild as HTMLElement;
      const left = parseFloat(menu.style.left);
      expect(left).toBeGreaterThanOrEqual(EDGE_MARGIN);
      expect(left).toBe(EDGE_MARGIN);
    });

    it("clamps a menu requested above the top edge inside the viewport", () => {
      const actions = makeActions();
      const { container } = render(
        <ContextMenu x={100} y={-50} onClose={onClose} actions={actions} />,
      );

      const menu = container.firstChild as HTMLElement;
      expect(parseFloat(menu.style.top)).toBe(EDGE_MARGIN);
    });

    it("clamps a menu requested beyond the bottom edge inside the viewport", () => {
      const actions = makeActions();
      const { container } = render(
        <ContextMenu x={100} y={VIEWPORT_HEIGHT + 200} onClose={onClose} actions={actions} />,
      );

      const menu = container.firstChild as HTMLElement;
      const top = parseFloat(menu.style.top);
      expect(top).toBeLessThanOrEqual(VIEWPORT_HEIGHT - estimatedHeight(actions.length) - EDGE_MARGIN);
    });

    it("uses the exact anchor coordinates when they are well inside the viewport", () => {
      const actions = makeActions();
      const { container } = render(
        <ContextMenu x={200} y={300} onClose={onClose} actions={actions} />,
      );

      const menu = container.firstChild as HTMLElement;
      expect(parseFloat(menu.style.left)).toBe(200);
      expect(parseFloat(menu.style.top)).toBe(300);
    });

    it("renders as a fixed, top-layer menu with the menu role", () => {
      const actions = makeActions();
      const { container } = render(
        <ContextMenu x={100} y={100} onClose={onClose} actions={actions} />,
      );

      const menu = container.firstChild as HTMLElement;
      expect(menu).toHaveAttribute("role", "menu");
      expect(menu).toHaveAttribute("aria-label", "API Card Options");
      expect(menu.style.position).toBe("fixed");
      expect(menu.style.zIndex).toBe("200");
    });
  });

  // ── Focus management ─────────────────────────────────────────────────────

  describe("focus management", () => {
    it("auto-focuses the first menuitem on mount", async () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      await act(async () => {});

      const items = screen.getAllByRole("menuitem");
      expect(items[0]).toHaveFocus();
    });

    it("renders one menuitem per action, in order", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      const items = screen.getAllByRole("menuitem");
      expect(items).toHaveLength(actions.length);
      expect(items[0]).toHaveTextContent("Copy URL");
      expect(items[1]).toHaveTextContent("Open in New Tab");
      expect(items[2]).toHaveTextContent("Remove");
    });

    it("renders an empty menu gracefully when there are no actions", () => {
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={[]} />);

      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    });
  });

  // ── Escape dismissal ─────────────────────────────────────────────────────

  describe("Escape dismissal", () => {
    it("calls onClose when Escape is pressed", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("ignores non-Escape keys", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.keyDown(document, { key: "Tab" });
      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "ArrowDown" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("removes the keydown listener on unmount", () => {
      const actions = makeActions();
      const { unmount } = render(
        <ContextMenu x={100} y={100} onClose={onClose} actions={actions} />,
      );

      unmount();
      onClose.mockClear();
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Outside pointer dismissal ─────────────────────────────────────────────

  describe("outside pointer dismissal", () => {
    it("calls onClose on mousedown outside the menu", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.mouseDown(document.body);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose on mousedown inside the menu", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.mouseDown(screen.getByRole("menu"));

      expect(onClose).not.toHaveBeenCalled();
    });

    it("does not call onClose when mousedown lands on a menuitem", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.mouseDown(screen.getAllByRole("menuitem")[0]);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("calls onClose on touchstart outside the menu", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.touchStart(document.body, { touches: [] });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("removes the pointer listeners on unmount", () => {
      const actions = makeActions();
      const { unmount } = render(
        <ContextMenu x={100} y={100} onClose={onClose} actions={actions} />,
      );

      unmount();
      onClose.mockClear();
      fireEvent.mouseDown(document.body);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Action invocation ─────────────────────────────────────────────────────

  describe("action invocation", () => {
    it("calls the item action and then onClose when a menuitem is clicked", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.click(screen.getAllByRole("menuitem")[0]);

      expect(actions[0].action).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("invokes the action before onClose", () => {
      const callOrder: string[] = [];
      const actions: ContextMenuAction[] = [
        { label: "Test Action", action: vi.fn(() => callOrder.push("action")) },
      ];
      const closeFn = vi.fn(() => callOrder.push("onClose"));

      render(<ContextMenu x={100} y={100} onClose={closeFn} actions={actions} />);
      fireEvent.click(screen.getByRole("menuitem"));

      expect(callOrder).toEqual(["action", "onClose"]);
    });

    it("calls only the clicked item's action", () => {
      const actions = makeActions();
      render(<ContextMenu x={100} y={100} onClose={onClose} actions={actions} />);

      fireEvent.click(screen.getAllByRole("menuitem")[1]);

      expect(actions[1].action).toHaveBeenCalledTimes(1);
      expect(actions[0].action).not.toHaveBeenCalled();
      expect(actions[2].action).not.toHaveBeenCalled();
    });

    it("stops click propagation so the host card does not also react", () => {
      const actions = makeActions();
      const parentClick = vi.fn();
      const { container } = render(
        <div onClick={parentClick}>
          <ContextMenu x={100} y={100} onClose={onClose} actions={actions} />
        </div>,
      );

      fireEvent.click(container.querySelector('[role="menu"]') as HTMLElement);

      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
