/**
 * MobileNavPanel — focus-trapped navigation panel used by the App topbar below
 * the collapse breakpoint (issue #1067).
 *
 * Opened by the topbar menu button, which owns `aria-expanded` / `aria-controls`.
 * The panel traps Tab while open, closes on Escape or backdrop click, and hands
 * focus back to the trigger through the `onClose` callback.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface MobileNavPanelProps {
  /** Element id referenced by the menu button's `aria-controls`. */
  id: string;
  /** Accessible name of the dialog. */
  label: string;
  /** Close request from Escape, backdrop, or a link activation. */
  onClose: () => void;
  children: ReactNode;
}

export default function MobileNavPanel({ id, label, onClose, children }: MobileNavPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    focusables()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusables();
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Portalled to <body>: the topbar owns a stacking context, so an inline panel
  // would be painted under the page content it is meant to cover.
  return createPortal(
    <>
      <div className="mobile-nav-backdrop" aria-hidden="true" data-testid="mobile-nav-backdrop" onClick={onClose} />
      <div ref={panelRef} id={id} role="dialog" aria-modal="true" aria-label={label} className="mobile-nav-panel" data-testid="mobile-nav-panel">
        {children}
      </div>
    </>,
    document.body,
  );
}
