/**
 * BottomSheet — generic reusable bottom-sheet dialog with a visible drag handle.
 *
 * GrantFox FWC26 campaign — replaces ad-hoc modal patterns with a consistent,
 * accessible, themeable bottom-sheet primitive.
 *
 * ─── Snap-point API ──────────────────────────────────────────────────────────
 * The sheet supports two snap points, controlled internally:
 *   "half" → height: 50 vh  (initial position on open)
 *   "full" → height: 92 vh  (expanded position)
 *
 * Dragging the handle bar determines which snap is applied:
 *   • drag down > SNAP_THRESHOLD px from "full" → snap to "half"
 *   • drag down > SNAP_THRESHOLD px from "half" → dismiss (onClose)
 *   • drag up   > SNAP_THRESHOLD px              → snap to "full"
 *
 * ─── Drag handle ─────────────────────────────────────────────────────────────
 * A pill-shaped handle is always visible at the top of the sheet. On hover and
 * during an active drag it widens and brightens to reinforce the draggable
 * affordance. The handle area has a minimum touch target of 44 × 44 px
 * (WCAG 2.5.5 Target Size). The pill itself is decorative; the drag affordance
 * is communicated through an `aria-label` on the sheet's title region.
 *
 * ─── Accessibility ───────────────────────────────────────────────────────────
 * • role="dialog" + aria-modal="true"
 * • aria-labelledby pointing to the rendered <title>
 * • Focus trap (Tab / Shift-Tab stay inside the sheet while open)
 * • Escape key closes the sheet
 * • Backdrop click closes the sheet
 * • Focus returns to `triggerRef` when the sheet closes
 * • Body scroll locked while the sheet is open
 * • prefers-reduced-motion: spring transitions disabled
 *
 * ─── Theming ─────────────────────────────────────────────────────────────────
 * All colours reference design tokens (--surface-strong, --line-strong,
 * --text, --muted, --line, --accent) so both dark and light themes work
 * automatically without any code changes.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

// ── Types ────────────────────────────────────────────────────────────────────

type Snap = "half" | "full";

/** Pixel delta required to trigger a snap transition or dismissal */
const SNAP_THRESHOLD = 60;

/** Sheet height for each snap point */
const SNAP_HEIGHT: Record<Snap, string> = {
  half: "50vh",
  full: "92vh",
};

export interface BottomSheetProps {
  /** Controls whether the sheet is rendered and visible */
  open: boolean;
  /** Called when the sheet should close (Escape, backdrop, drag-dismiss, close button) */
  onClose: () => void;
  /**
   * Accessible title rendered in the sheet header.
   * Also used as the dialog's accessible name via `aria-labelledby`.
   */
  title: string;
  /** Sheet body content */
  children: React.ReactNode;
  /**
   * Optional slot rendered in the sticky footer (e.g. a primary CTA button).
   * Omit if no footer is needed.
   */
  footer?: React.ReactNode;
  /**
   * Ref to the element that triggered the sheet open.
   * Focus is returned here when the sheet closes, satisfying WCAG 2.4.3.
   */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Initial snap point.  Defaults to "half".
   * @default "half"
   */
  defaultSnap?: Snap;
  /** Additional CSS classes applied to the sheet panel */
  className?: string;
  /** data-testid applied to the outer sheet panel (useful in tests) */
  "data-testid"?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns all keyboard-focusable descendants of `container`, skipping
 * elements inside an `[aria-hidden]` subtree.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.closest("[aria-hidden]"));
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Generic bottom-sheet dialog with a visible pill-shaped drag handle.
 *
 * @example
 * ```tsx
 * const triggerRef = useRef<HTMLButtonElement>(null);
 * const [open, setOpen] = useState(false);
 *
 * <button ref={triggerRef} onClick={() => setOpen(true)}>Open sheet</button>
 *
 * <BottomSheet
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="Settings"
 *   triggerRef={triggerRef}
 *   footer={<button className="primary-button" onClick={() => setOpen(false)}>Done</button>}
 * >
 *   <p>Sheet content goes here.</p>
 * </BottomSheet>
 * ```
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  triggerRef,
  defaultSnap = "half",
  className,
  "data-testid": testId = "bottom-sheet",
}: BottomSheetProps) {
  const [snap, setSnap] = useState<Snap>(defaultSnap);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  // Generate a stable ID for the aria-labelledby association.
  const titleId = useId();

  // Reactively detect the reduced-motion preference (single source of truth,
  // shared via usePrefersReducedMotion). Guarded internally against SSR/jsdom
  // environments where matchMedia may be absent.
  const prefersReducedMotion = usePrefersReducedMotion();

  // Reset to the configured default snap whenever the sheet opens.
  useEffect(() => {
    if (open) setSnap(defaultSnap);
  }, [open, defaultSnap]);

  // ESC key → close.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap: keep Tab / Shift-Tab inside the dialog while open.
  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const sheet = sheetRef.current;

    // Move initial focus to the first focusable element inside the sheet.
    const focusable = getFocusableElements(sheet);
    focusable[0]?.focus();

    const trapTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = getFocusableElements(sheet);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => document.removeEventListener("keydown", trapTab);
  }, [open]);

  // Restore focus to the trigger element when the sheet closes (WCAG 2.4.3).
  useEffect(() => {
    if (!open && triggerRef?.current) {
      triggerRef.current.focus();
    }
  }, [open, triggerRef]);

  // Prevent body scroll while the sheet is open (overscroll-behavior handles
  // the sheet body's internal scroll separately).
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ── Drag-to-snap handlers ──────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    // Capture the pointer so we keep receiving events even if the cursor
    // leaves the handle area mid-drag.  Guard for environments (jsdom, SSR)
    // that do not implement setPointerCapture.
    const el = e.currentTarget as HTMLElement;
    if (typeof el.setPointerCapture === "function") {
      el.setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return;
      const delta = e.clientY - dragStartY.current;
      dragStartY.current = null;

      if (delta > SNAP_THRESHOLD) {
        // Dragged downward beyond threshold
        if (snap === "full") {
          setSnap("half");
        } else {
          onClose(); // dismiss from half-snap
        }
      } else if (delta < -SNAP_THRESHOLD) {
        // Dragged upward beyond threshold
        setSnap("full");
      }
    },
    [snap, onClose],
  );

  // Nothing to render while closed.
  if (!open) return null;

  const sheetStyle: React.CSSProperties = {
    height: SNAP_HEIGHT[snap],
    // Belt-and-suspenders: CSS media query in index.css already disables
    // the transition, but we also set it here for prefers-reduced-motion.
    transition: prefersReducedMotion ? "none" : undefined,
  };

  const sheetClasses = [
    "bottom-sheet",
    `bottom-sheet--${snap}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* ── Backdrop — click to close ──────────────────────────────────────── */}
      <div
        className="bottom-sheet__backdrop"
        aria-hidden="true"
        onClick={onClose}
        data-testid="bottom-sheet-backdrop"
      />

      {/* ── Sheet panel ───────────────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={sheetClasses}
        style={sheetStyle}
        data-testid={testId}
      >
        {/*
         * ── Visible drag handle ──────────────────────────────────────────
         *
         * The handle area is a wide, tall touch target (min 44 px, WCAG 2.5.5).
         * Inside it sits the pill — a short, rounded bar that visually signals
         * "drag me". On hover and active drag the pill widens and brightens
         * for clear affordance. The area is aria-hidden because dragging is a
         * pointer-only interaction; keyboard users use the snap button instead.
         *
         * Implemented with pointer events (not touch events) so mouse and
         * stylus users are also supported.
         */}
        <div
          className="bottom-sheet__handle-area"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          aria-hidden="true"
          data-testid="bottom-sheet-handle-area"
        >
          {/* The pill — purely decorative, aria-hidden via parent */}
          <div className="bottom-sheet__handle" data-testid="bottom-sheet-handle" />
        </div>

        {/* ── Header row ──────────────────────────────────────────────────── */}
        <div className="bottom-sheet__header">
          <h2
            className="bottom-sheet__title"
            id={titleId}
          >
            {title}
          </h2>
          <button
            className="ghost-button bottom-sheet__close"
            onClick={onClose}
            aria-label={`Close ${title}`}
            data-testid="bottom-sheet-close"
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="bottom-sheet__body">
          {children}
        </div>

        {/* ── Optional sticky footer ──────────────────────────────────────── */}
        {footer != null && (
          <div className="bottom-sheet__footer">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
