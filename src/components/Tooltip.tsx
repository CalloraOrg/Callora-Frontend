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
  /** Delay in ms before the tooltip opens on mouse hover. Defaults to 0. */
  hoverDelayMs?: number;
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

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (isValidElement(children) && typeof (children.props as any).onMouseEnter === "function") {
      (children.props as any).onMouseEnter(e);
    }
    clearHoverTimer();
    if (hoverDelayMs > 0) {
      hoverTimer.current = window.setTimeout(() => setOpen(true), hoverDelayMs);
    } else {
      setOpen(true);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isValidElement(children) && typeof (children.props as any).onTouchStart === "function") {
      (children.props as any).onTouchStart(e);
    }
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => setOpen(true), longPressMs);
  };

  const trigger = isValidElement(children) ? (
    cloneElement(children, {
      "aria-describedby": open ? tooltipId : undefined,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: (e: React.MouseEvent) => {
        if (typeof (children.props as any).onMouseLeave === "function") {
          (children.props as any).onMouseLeave(e);
        }
        hide();
      },
      onFocus: (e: React.FocusEvent) => {
        if (typeof (children.props as any).onFocus === "function") {
          (children.props as any).onFocus(e);
        }
        show();
      },
      onBlur: (e: React.FocusEvent) => {
        if (typeof (children.props as any).onBlur === "function") {
          (children.props as any).onBlur(e);
        }
        hide();
      },
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
