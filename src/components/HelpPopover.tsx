import { useId } from "react";
import Tooltip from "./Tooltip";
import { InfoIcon } from "./icons/InfoIcon";

/**
 * HelpPopover
 *
 * An accessible info popover (ⓘ icon) that explains a metric or field to
 * first-time users. Built on top of the existing {@link Tooltip} component
 * so it inherits WCAG 2.1 AA keyboard/ touch/ screen-reader support and
 * design-token colour theming.
 *
 * **When to use**
 * Place next to a UI control or label whose meaning may not be obvious to
 * first-time users — e.g. a subscription price, a rate limit, or a data
 * metric.
 *
 * **Accessibility (WCAG 2.1 AA)**
 * - The trigger button receives a unique `aria-label` passed via the
 *   `ariaLabel` prop (default: "Help").
 * - The tooltip content is connected to the trigger via `aria-describedby`
 *   (handled by the inner `Tooltip`).
 * - `Escape` dismisses the open popover.
 * - Focus management: the icon button is keyboard-focusable and receives the
 *   theme's global `:focus-visible` ring.
 *
 * **Responsive**
 * - The popover content wraps naturally; `Tooltip` caps width at 240 px with
 *   `max-width: calc(100vw - 32px)` so it never overflows small viewports.
 * - On touch devices a long-press (≥500 ms) reveals the popover.
 *
 * **Theme & tokens**
 * Uses `--tooltip-bg`, `--tooltip-text`, `--border-subtle` tokens defined by
 * `Tooltip`, which resolve to theme-appropriate values in light and dark
 * mode.
 *
 * @param content  – The explanatory text / node shown inside the popover.
 * @param ariaLabel – Accessible label for the info icon button.
 *                   Default: "Help".
 * @param hoverDelayMs – Hover delay before the popover appears.
 *                       Default: 300 ms (avoids flashing during cursor travel).
 */

type HelpPopoverProps = {
  /** Explanatory content shown inside the popover. */
  content: React.ReactNode;
  /**
   * Accessible label for the info-icon trigger button.
   * @default "Help"
   */
  ariaLabel?: string;
  /**
   * Milliseconds to wait before showing the popover on hover.
   * @default 300
   */
  hoverDelayMs?: number;
  /**
   * Additional CSS class forwarded to the trigger button.
   * Useful for layout alignment in page headers (e.g. LatencyChart).
   */
  className?: string;
};

export default function HelpPopover({
  content,
  ariaLabel = "Help",
  hoverDelayMs = 300,
  className,
}: HelpPopoverProps): JSX.Element {
  const labelId = useId();

  return (
    <Tooltip content={content} hoverDelayMs={hoverDelayMs}>
      <button
        type="button"
        className={`help-popover-trigger${className ? ` ${className}` : ""}`}
        aria-label={ariaLabel}
        aria-describedby={labelId}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          padding: 0,
          border: "none",
          borderRadius: "50%",
          background: "transparent",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <InfoIcon size={16} aria-hidden="true" />
        <span id={labelId} className="sr-only">
          {ariaLabel}
        </span>
      </button>
    </Tooltip>
  );
}
