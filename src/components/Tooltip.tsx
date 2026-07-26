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
 * Tooltip — an accessible tooltip that opens on hover (with optional delay),
 * keyboard focus, and touch long-press (issue #283).
 *
 * Wired to Breadcrumb icon-only buttons per issue #578.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The trigger gets `aria-describedby` pointing at the tooltip content.
 * - Content has `role="tooltip"`.
 * - Escape dismisses an open tooltip.
 * - Colours come from design tokens so it reads in light and dark mode.
 *
 * @param content      Tooltip body. Plain text or rich nodes.
 * @param children     Single focusable trigger element (e.g. a <button>).
 * @param hoverDelayMs Milliseconds to wait after mouseenter before the tooltip
 *                     opens. Defaults to 300 ms. Set to 0 for instant reveal.
 * @param longPressMs  Touch long-press duration in ms. Defaults to 500 ms.
 */

type TooltipProps = {
  /** Tooltip body. Plain text or rich nodes. */
  content: ReactNode;
  /** Single focusable trigger element (e.g. a <span> or <button>). */
  children: ReactElement;
  /**
   * Hover delay in ms before the tooltip opens.
   * Helps avoid accidental flashes during fast cursor movement.
   * @default 300
   */
  hoverDelayMs?: number;
  /** Long-press duration in ms before the tooltip opens on touch. */
  longPressMs?: number;
  /** Delay in ms before the tooltip opens on mouse hover. Defaults to 0. */
  hoverDelayMs?: number;
};

export default function Tooltip({
  content,
  children,
  hoverDelayMs = 300,
  longPressMs = 500,
  hoverDelayMs = 0,
}: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  // Timer for delayed hover reveal.
  const hoverTimer = useRef<number | null>(null);
  // Timer for touch long-press reveal.
  const pressTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const clearPressTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // Clean up both timers on unmount.
  useEffect(
    () => () => {
      clearHoverTimer();
      clearPressTimer();
    },
    [],
  );

  // Dismiss on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /**
   * Start the hover-delay timer.
   * If hoverDelayMs is 0 we open immediately to keep the
   * interaction snappy for callers that want instant feedback.
   */
  const handleMouseEnter = () => {
    clearHoverTimer();
    if (hoverDelayMs <= 0) {
      setOpen(true);
    } else {
      hoverTimer.current = window.setTimeout(
        () => setOpen(true),
        hoverDelayMs,
      );
    }
  };

  const hide = () => {
    clearHoverTimer();
    clearPressTimer();
    clearHoverTimer();
    setOpen(false);
  };

  // Keyboard focus shows instantly (no delay needed — user is already there).
  const handleFocus = () => {
    clearHoverTimer();
    setOpen(true);
  };

  // Touch: start long-press timer.
  const handleTouchStart = () => {
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => setOpen(true), longPressMs);
  };

  const trigger = isValidElement(children) ? (
    cloneElement(children, {
      "aria-describedby": open ? tooltipId : undefined,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: hide,
      onFocus: handleFocus,
      onBlur: hide,
      onTouchStart: handleTouchStart,
      onTouchEnd: (e: React.TouchEvent) => {
        if (typeof (children.props as any).onTouchEnd === "function") {
          (children.props as any).onTouchEnd(e);
        }
        clearPressTimer();
      },
      onTouchCancel: (e: React.TouchEvent) => {
        if (typeof (children.props as any).onTouchCancel === "function") {
          (children.props as any).onTouchCancel(e);
        }
        clearPressTimer();
      },
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
