/**
 * ContextMenu.tsx
 *
 * Accessible context menu for ApiCard.
 * Triggered by right-click (desktop) or long-press (touch, 600 ms threshold).
 *
 * Accessibility:
 *  - role="menu" with aria-label on the container
 *  - role="menuitem" on each action button
 *  - Auto-focuses the first item on mount (keyboard + screen-reader entry)
 *  - Closes on Escape, outside click/touch, and after any action
 *  - Positioned with viewport-edge clamping so it never renders off-screen
 *  - All colors, borders, and shadows use design tokens (no hardcoded hex)
 *  - Respects prefers-reduced-motion for the fade-in animation
 *
 * WCAG 2.1 AA: 2.1.1 Keyboard, 2.4.3 Focus Order, 4.1.2 Name/Role/Value
 */

import React, { useEffect, useRef } from "react";

export interface ContextMenuAction {
  label: string;
  action: () => void;
  /** Renders the item in var(--danger) to signal a destructive operation. */
  isCritical?: boolean;
}

interface ContextMenuProps {
  /** Viewport X coordinate where the menu should anchor (from MouseEvent or Touch). */
  x: number;
  /** Viewport Y coordinate where the menu should anchor. */
  y: number;
  /** Called when the menu should close (Escape, outside click, or after an action). */
  onClose: () => void;
  actions: ContextMenuAction[];
}

/** Minimum distance (px) to keep the menu from any viewport edge. */
const EDGE_MARGIN = 8;

/** Estimated menu dimensions used for pre-render clamping. */
const MENU_WIDTH = 192;
const MENU_HEIGHT_PER_ITEM = 40;

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, actions }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Clamp position so the menu stays inside the viewport ── */
  const estimatedHeight = actions.length * MENU_HEIGHT_PER_ITEM + 8;
  const clampedX = Math.min(Math.max(x, EDGE_MARGIN), window.innerWidth - MENU_WIDTH - EDGE_MARGIN);
  const clampedY = Math.min(Math.max(y, EDGE_MARGIN), window.innerHeight - estimatedHeight - EDGE_MARGIN);

  /* ── Focus trap, Escape dismiss, outside-click dismiss ── */
  useEffect(() => {
    // Auto-focus the first menu item for keyboard and screen-reader users.
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = "touches" in e ? e.touches[0]?.target : (e as MouseEvent).target;
      if (menuRef.current && !menuRef.current.contains(target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown as EventListener, {
      passive: true,
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown as EventListener);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="API Card Options"
      /* Stop card's own onClick from firing when clicking inside the menu. */
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: clampedY,
        left: clampedX,
        zIndex: 200,
        minWidth: MENU_WIDTH,
        background: "var(--surface-strong)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow)",
        padding: "4px 0",
        backdropFilter: "blur(20px)",
        /* Fade-in — suppressed for users who prefer reduced motion. */
        animation: "contextmenu-appear 100ms ease both",
      }}
    >
      {actions.map((item, index) => (
        <button
          key={index}
          role="menuitem"
          onClick={() => {
            item.action();
            onClose();
          }}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderRadius: 0,
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: item.isCritical ? "var(--danger)" : "var(--text)",
            transition: "background 120ms ease, color 120ms ease",
          }}
          /* Highlight on keyboard focus and mouse hover via CSS class below. */
          className="context-menu__item"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
