/**
 * FiltersBottomSheet — mobile-only bottom-sheet wrapper for FiltersSidebar.
 *
 * Snap-point API
 * ──────────────
 * The sheet supports two snap points, controlled by the `snap` state:
 *   "half" → height: 50vh   (initial position on open)
 *   "full" → height: 92vh   (expanded position)
 *
 * Dragging the handle bar determines which snap is applied:
 *   • drag down > SNAP_THRESHOLD px from "full"  → snap to "half"
 *   • drag down > SNAP_THRESHOLD px from "half"  → dismiss (onClose)
 *   • drag up   > SNAP_THRESHOLD px              → snap to "full"
 *
 * Spring animations are gated behind `prefers-reduced-motion: no-preference`
 * so users who have requested reduced motion get instant transitions.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import FiltersSidebar from "./FiltersSidebar";

type Snap = "half" | "full";

/** Pixel delta required to trigger a snap transition or dismissal */
const SNAP_THRESHOLD = 60;

/** Sheet height for each snap point */
const SNAP_HEIGHT: Record<Snap, string> = {
  half: "50vh",
  full: "92vh",
};

interface FiltersBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Live result count shown in the footer CTA */
  resultCount: number;
  selectedCategories: Set<string>;
  toggleCategory: (c: string) => void;
  minPrice: number | null;
  maxPrice: number | null;
  setMinPrice: (v: number | null) => void;
  setMaxPrice: (v: number | null) => void;
  popularity: string;
  setPopularity: (p: string) => void;
  clearFilters: () => void;
  favoritesOnly: boolean;
  toggleFavoritesOnly: () => void;
  /** Ref to the trigger button so focus is restored on close */
  triggerRef: React.RefObject<HTMLButtonElement>;
}

export default function FiltersBottomSheet({
  open,
  onClose,
  resultCount,
  selectedCategories,
  toggleCategory,
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  popularity,
  setPopularity,
  clearFilters,
  favoritesOnly,
  toggleFavoritesOnly,
  triggerRef,
}: FiltersBottomSheetProps) {
  const [snap, setSnap] = useState<Snap>("half");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  // Detect reduced-motion preference once; stable for the component lifetime.
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reset to half-snap whenever the sheet opens.
  useEffect(() => {
    if (open) setSnap("half");
  }, [open]);

  // ESC key → close.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap: keep Tab/Shift-Tab inside the dialog while open.
  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const sheet = sheetRef.current;
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

  // Restore focus to the trigger button when the sheet closes.
  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open, triggerRef]);

  // Prevent body scroll while the sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ── Drag-to-snap handlers ────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current === null) return;
      const delta = e.clientY - dragStartY.current;
      dragStartY.current = null;

      if (delta > SNAP_THRESHOLD) {
        // Dragged downward
        if (snap === "full") {
          setSnap("half");
        } else {
          onClose(); // dismiss from half-snap
        }
      } else if (delta < -SNAP_THRESHOLD) {
        // Dragged upward
        setSnap("full");
      }
    },
    [snap, onClose],
  );

  if (!open) return null;

  const sheetStyle: React.CSSProperties = {
    height: SNAP_HEIGHT[snap],
    // Disable the transition animation when user prefers reduced motion.
    transition: prefersReducedMotion ? "none" : undefined,
  };

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        className="bottom-sheet__backdrop"
        aria-hidden="true"
        onClick={onClose}
        data-testid="bottom-sheet-backdrop"
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={`bottom-sheet bottom-sheet--${snap}`}
        style={sheetStyle}
        data-testid="bottom-sheet"
      >
        {/* Drag handle — pointer events only, hidden from AT */}
        <div
          className="bottom-sheet__handle-area"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          aria-hidden="true"
          data-testid="bottom-sheet-handle-area"
        >
          <div className="bottom-sheet__handle" />
        </div>

        {/* Header row */}
        <div className="bottom-sheet__header">
          <h2 className="bottom-sheet__title" id="bottom-sheet-title">
            Filters
          </h2>
          <button
            className="ghost-button bottom-sheet__close"
            onClick={onClose}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        {/* Scrollable filter body */}
        <div className="bottom-sheet__body">
          <FiltersSidebar
            selectedCategories={selectedCategories}
            toggleCategory={toggleCategory}
            minPrice={minPrice}
            maxPrice={maxPrice}
            setMinPrice={setMinPrice}
            setMaxPrice={setMaxPrice}
            popularity={popularity}
            setPopularity={setPopularity}
            clearFilters={clearFilters}
            favoritesOnly={favoritesOnly}
            toggleFavoritesOnly={toggleFavoritesOnly}
          />
        </div>

        {/* Footer — live result count CTA */}
        <div className="bottom-sheet__footer">
          <button
            className="primary-button bottom-sheet__show-btn"
            onClick={onClose}
          >
            Show {resultCount} result{resultCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </>
  );
}

/** Returns all keyboard-focusable descendants of `container`, excluding aria-hidden ones. */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.closest("[aria-hidden]"));
}
