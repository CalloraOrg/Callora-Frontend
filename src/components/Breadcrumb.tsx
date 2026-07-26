import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

type BreadcrumbItem = {
  label: string;
  href: string;
  isCurrent?: boolean;
};

type BreadcrumbProps = {
  items: ReadonlyArray<BreadcrumbItem>;
  /**
   * When greater than 0 any individual crumb label that exceeds this character
   * count will be visually shortened using a middle-ellipsis (e.g.
   * "Very Long … Label Here").  The full text is always preserved in the
   * element's `title` attribute and, for non-current links, as the accessible
   * name via `aria-label`, so screen-reader and hover users always see the
   * complete value.
   *
   * Must be ≥ 8 to leave room for at least one character on each side of the
   * ellipsis.  Values below 8 are silently clamped to 0 (no truncation).
   *
   * @default 0 (no truncation)
   */
  maxLabelLength?: number;
};

/**
 * Shorten `label` to `max` characters using a middle-ellipsis strategy.
 *
 * Characters are split roughly half-and-half around the "…" character so that
 * both the start and end of the label remain visible — useful for long API
 * path segments where the terminal identifier is just as meaningful as the
 * root namespace.
 *
 * Returns the original string unchanged when:
 * - `max` is 0 (feature disabled)
 * - `max` < 8 (not enough room to produce a meaningful result)
 * - `label.length` ≤ `max`
 */
export function truncateMiddle(label: string, max: number): string {
  if (max < 8 || label.length <= max) return label;

  // Reserve one character for the ellipsis itself.
  const budget = max - 1; // characters available for actual content
  const endLen = Math.floor(budget / 2);
  const startLen = budget - endLen;

  return `${label.slice(0, startLen)}\u2026${label.slice(label.length - endLen)}`;
}

function BreadcrumbLink({
  item,
  displayLabel,
}: {
  item: BreadcrumbItem;
  /** Visually displayed text; may be a middle-truncated version of item.label. */
  displayLabel: string;
}) {
  const isTruncated = displayLabel !== item.label;

  if (item.isCurrent) {
    return (
      <span
        className="breadcrumb-current"
        aria-current="page"
        // Always expose the full label to assistive technology and on hover.
        title={item.label}
        // When truncated, override the accessible name so screen readers
        // announce the complete string rather than the ellipsis variant.
        {...(isTruncated ? { "aria-label": item.label } : {})}
      >
        {displayLabel}
      </span>
    );
  }

  return (
    <a
      className="breadcrumb-link link-nav"
      href={item.href}
      title={item.label}
      {...(isTruncated ? { "aria-label": item.label } : {})}
    >
      {displayLabel}
    </a>
  );
}

function BreadcrumbSeparator() {
  return (
    <span aria-hidden="true" className="breadcrumb-separator">
      /
    </span>
  );
}

export default function Breadcrumb({ items, maxLabelLength = 0 }: BreadcrumbProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const ellipsisButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const middleItems = useMemo(() => items.slice(1, -1), [items]);
  const shouldCollapseMiddle = middleItems.length > 0;

  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
        ellipsisButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverOpen]);

  useEffect(() => {
    if (!isPopoverOpen) return;

    popoverRef.current
      ?.querySelector<HTMLAnchorElement>('[role="menuitem"]')
      ?.focus();
  }, [isPopoverOpen]);

  const handlePopoverKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const menuItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLAnchorElement>(
        '[role="menuitem"]',
      ),
    );

    if (menuItems.length === 0) return;

    const currentIndex = menuItems.indexOf(
      document.activeElement as HTMLAnchorElement,
    );
    const focusMenuItem = (index: number) => {
      event.preventDefault();
      menuItems[index]?.focus();
    };

    switch (event.key) {
      case "ArrowDown":
        focusMenuItem(
          currentIndex === -1 ? 0 : (currentIndex + 1) % menuItems.length,
        );
        break;
      case "ArrowUp":
        focusMenuItem(
          currentIndex === -1
            ? menuItems.length - 1
            : (currentIndex - 1 + menuItems.length) % menuItems.length,
        );
        break;
      case "Home":
        focusMenuItem(0);
        break;
      case "End":
        focusMenuItem(menuItems.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        setIsPopoverOpen(false);
        ellipsisButtonRef.current?.focus();
        break;
    }
  };

  return (
    <nav aria-label="breadcrumb" className="breadcrumb-nav">
      <style>
        {`
          .breadcrumb-nav {
            margin-bottom: 16px;
            font-size: 0.875rem;
            padding-left: 32px;
            max-width: 100%;
          }

          .breadcrumb-list,
          .breadcrumb-popover-list {
            list-style: none;
            margin: 0;
            padding: 0;
          }

          .breadcrumb-list {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            max-width: 100%;
          }

          .breadcrumb-item,
          .breadcrumb-collapsed {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .breadcrumb-link,
          .breadcrumb-current,
          .breadcrumb-popover-link {
            display: inline-block;
            max-width: min(34vw, 18rem);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            border-radius: 2px;
          }

          .breadcrumb-link,
          .breadcrumb-popover-link {
            color: var(--accent);
            padding: 4px 0;
          }

          .breadcrumb-link:focus-visible,
          .breadcrumb-popover-link:focus-visible,
          .breadcrumb-ellipsis:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
          }

          .breadcrumb-current {
            color: var(--text);
            font-weight: 500;
          }

          .breadcrumb-separator {
            color: var(--muted);
            flex: 0 0 auto;
            margin: 0 4px;
          }

          .breadcrumb-collapsed {
            position: relative;
            display: none;
          }

          .breadcrumb-ellipsis {
            align-items: center;
            background: transparent;
            border: 0;
            border-radius: 2px;
            color: var(--accent);
            cursor: pointer;
            display: inline-flex;
            font: inherit;
            font-weight: 700;
            justify-content: center;
            min-height: 28px;
            min-width: 28px;
            padding: 0 6px;
          }

          .breadcrumb-popover {
            background: var(--surface, #fff);
            border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
            left: 0;
            margin-top: 8px;
            min-width: 180px;
            padding: 8px;
            position: absolute;
            top: 100%;
            z-index: 20;
          }

          .breadcrumb-popover-list {
            display: grid;
            gap: 4px;
          }

          .breadcrumb-popover-link {
            max-width: 240px;
            padding: 6px 8px;
          }

          @media (max-width: 480px) {
            .breadcrumb-nav {
              padding-left: 0;
            }

            .breadcrumb-list {
              gap: 4px;
              overflow: visible;
            }

            .breadcrumb-middle {
              display: none;
            }

            .breadcrumb-collapsed {
              display: flex;
            }

            .breadcrumb-first .breadcrumb-link,
            .breadcrumb-current {
              max-width: min(38vw, 11rem);
            }
          }
        `}
      </style>

      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const isMiddle = !isFirst && !isLast;
          const displayLabel = truncateMiddle(item.label, maxLabelLength);

          if (isMiddle) {
            return (
              <li className="breadcrumb-item breadcrumb-middle" key={item.href}>
                <BreadcrumbLink item={item} displayLabel={displayLabel} />
                <BreadcrumbSeparator />
              </li>
            );
          }

          return (
            <li
              className={`breadcrumb-item ${isFirst ? "breadcrumb-first" : ""}`}
              key={item.href}
            >
              <BreadcrumbLink item={item} displayLabel={displayLabel} />
              {isFirst && shouldCollapseMiddle && (
                <span className="breadcrumb-collapsed">
                  <BreadcrumbSeparator />
                  <button
                    ref={ellipsisButtonRef}
                    type="button"
                    className="breadcrumb-ellipsis"
                    aria-label="Show collapsed breadcrumb items"
                    aria-haspopup="menu"
                    aria-expanded={isPopoverOpen}
                    aria-controls={popoverId}
                    onClick={() => setIsPopoverOpen((open) => !open)}
                  >
                    ...
                  </button>
                  {isPopoverOpen && (
                    <div
                      ref={popoverRef}
                      className="breadcrumb-popover"
                      id={popoverId}
                      role="menu"
                      aria-label="Collapsed breadcrumb items"
                      onKeyDown={handlePopoverKeyDown}
                    >
                      <ol className="breadcrumb-popover-list">
                        {middleItems.map((middleItem) => {
                          const middleDisplayLabel = truncateMiddle(
                            middleItem.label,
                            maxLabelLength,
                          );
                          const isTruncated =
                            middleDisplayLabel !== middleItem.label;
                          return (
                            <li key={middleItem.href} role="none">
                              <a
                                className="breadcrumb-popover-link link-nav"
                                href={middleItem.href}
                                role="menuitem"
                                title={middleItem.label}
                                {...(isTruncated
                                  ? { "aria-label": middleItem.label }
                                  : {})}
                              >
                                {middleDisplayLabel}
                              </a>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </span>
              )}
              {!isLast && <BreadcrumbSeparator />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
