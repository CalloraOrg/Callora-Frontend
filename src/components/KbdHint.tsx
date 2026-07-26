import type { Shortcut } from "../hooks/useGlobalShortcuts";

export type KbdHintVariant = "default" | "chip" | "subtle";

export type KbdHintProps = {
  /** Array of shortcut items to display. */
  shortcuts?: readonly Shortcut[];
  /** Single shortcut item to display as a shorthand. */
  shortcut?: Shortcut;
  /** Accessible label for the container (defaults to "Keyboard shortcuts"). */
  label?: string;
  /** Visual presentation style: "default" | "chip" | "subtle". */
  variant?: KbdHintVariant;
  /** HTML container element: defaults to "aside" for default variant, "span" for chip/subtle variants. */
  as?: "aside" | "span" | "div";
  /** Additional CSS class names. */
  className?: string;
};

/**
 * KbdHint
 *
 * Renders keyboard shortcut hints with support for default list view,
 * compact pill chips (`variant="chip"`), and subtle contextual hints (`variant="subtle"`).
 * WCAG 2.1 AA accessible and design-token compliant.
 */
export default function KbdHint({
  shortcuts,
  shortcut,
  label = "Keyboard shortcuts",
  variant = "default",
  as,
  className = "",
}: KbdHintProps) {
  const list: readonly Shortcut[] = shortcuts ?? (shortcut ? [shortcut] : []);

  if (list.length === 0) return null;

  const Component = as ?? (variant === "default" ? "aside" : "span");

  const combinedClassName = [
    "kbd-hint",
    variant !== "default" ? `kbd-hint--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={combinedClassName} aria-label={label}>
      {list.map((item) => (
        <span className="kbd-hint__item" key={`${item.key}-${item.description}`}>
          <kbd className="kbd-hint__key">{item.key}</kbd>
          {item.description && <span className="kbd-hint__description">{item.description}</span>}
        </span>
      ))}
    </Component>
  );
}

