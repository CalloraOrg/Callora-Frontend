import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type TouchEvent,
} from "react";

/**
 * Tooltip — an accessible tooltip that opens on hover (optional delay),
 * keyboard focus, and touch long-press (issues #283, #533).
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
  /** Delay in ms before the tooltip opens on mouse hover. Defaults to 0. */
  hoverDelayMs?: number;
};

type ChildHandlers = {
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onTouchStart?: (e: TouchEvent) => void;
  onTouchEnd?: (e: TouchEvent) => void;
  onTouchCancel?: (e: TouchEvent) => void;
};

export default function Tooltip({
  content,
  children,
  longPressMs = 500,
  hoverDelayMs = 0,
}: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const pressTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const clearPressTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPressTimer();
      clearHoverTimer();
    };
  }, []);

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
    clearHoverTimer();
    setOpen(false);
  };

  const childProps = (
    isValidElement(children) ? (children.props as ChildHandlers) : {}
  ) as ChildHandlers;

  const handleMouseEnter = (e: MouseEvent) => {
    childProps.onMouseEnter?.(e);
    clearHoverTimer();
    if (hoverDelayMs > 0) {
      hoverTimer.current = window.setTimeout(() => setOpen(true), hoverDelayMs);
    } else {
      setOpen(true);
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    childProps.onTouchStart?.(e);
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => setOpen(true), longPressMs);
  };

  const trigger = isValidElement(children) ? (
    cloneElement(children, {
      "aria-describedby": open ? tooltipId : undefined,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: (e: MouseEvent) => {
        childProps.onMouseLeave?.(e);
        hide();
      },
      onFocus: (e: FocusEvent) => {
        childProps.onFocus?.(e);
        show();
      },
      onBlur: (e: FocusEvent) => {
        childProps.onBlur?.(e);
        hide();
      },
      onTouchStart: handleTouchStart,
      onTouchEnd: (e: TouchEvent) => {
        childProps.onTouchEnd?.(e);
        clearPressTimer();
      },
      onTouchCancel: (e: TouchEvent) => {
        childProps.onTouchCancel?.(e);
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
