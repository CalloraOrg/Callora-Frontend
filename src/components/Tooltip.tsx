import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Tooltip — an accessible tooltip that opens on hover, keyboard focus, and
 * touch long-press (issue #283).
 *
 * Accessibility (WCAG 2.1 AA):
 * - The trigger gets `aria-describedby` pointing at the tooltip content.
 * - Content has `role="tooltip"`.
 * - Escape dismisses an open tooltip.
 * - Colours come from design tokens so it reads in light and dark mode.
 */

type TooltipProps = {
  /** Tooltip body. Plain text or rich nodes. */
  content: ReactNode;
  /** Single focusable trigger element (e.g. a <span> or <button>). */
  children: ReactElement;
  /** Long-press duration in ms before the tooltip opens on touch. */
  longPressMs?: number;
};

export default function Tooltip({
  content,
  children,
  longPressMs = 500,
}: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const pressTimer = useRef<number | null>(null);

  const clearPressTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => clearPressTimer, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const show = () => setOpen(true);
  const hide = () => {
    clearPressTimer();
    setOpen(false);
  };

  const handleTouchStart = () => {
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => setOpen(true), longPressMs);
  };

  const trigger = isValidElement(children) ? (
    cloneElement(children, {
      "aria-describedby": open ? tooltipId : undefined,
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      onTouchStart: handleTouchStart,
      onTouchEnd: clearPressTimer,
      onTouchCancel: clearPressTimer,
    } as Record<string, unknown>)
  ) : (
    children
  );

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseLeave={hide}
    >
      {trigger}
      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            maxWidth: "240px",
            width: "max-content",
            padding: "0.5rem 0.625rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            lineHeight: 1.4,
            textAlign: "left",
            color: "var(--tooltip-text, #ffffff)",
            background: "var(--tooltip-bg, #1f2937)",
            border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            pointerEvents: "none",
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
