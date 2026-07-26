import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Tooltip from "./Tooltip";

export type BreadcrumbItem = {
  label: string;
  href: string;
  isCurrent?: boolean;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  /**
   * When true, individual crumb labels that exceed `middleEllipsisMaxLen`
   * characters are truncated with a middle-ellipsis pattern:
   *   "VeryLongStartText…endText"
   * This preserves both the beginning (which names the resource type) and the
   * end (which often carries a unique identifier or slug), giving users enough
   * context to understand the path even when space is tight.
   *
   * The full label is always accessible via the `title` tooltip and the
   * aria-label on the link, so screen-reader users are unaffected.
   *
   * @default false
   */
  middleEllipsis?: boolean;
  /**
   * Maximum character length before the middle-ellipsis kicks in.
   * Only relevant when `middleEllipsis` is true.
   * @default 24
   */
  middleEllipsisMaxLen?: number;
};

/**
 * truncateMiddle
 *
 * Truncates `text` to at most `maxLen` visible characters using a
 * middle-ellipsis pattern: the beginning and end of the string are
 * preserved, with "…" inserted in the middle.
 *
 * Examples:
 *   truncateMiddle("VeryLongMachineLearningAPIName", 24)
 *     → "VeryLongMachin…APIName"
 *   truncateMiddle("short", 24) → "short"   (unchanged)
 *
 * The split favours the start slightly (ceil) so the resource-type prefix
 * is more likely to remain legible.
 *
 * @param text   The full label string.
 * @param maxLen Maximum visible characters (excluding the ellipsis itself).
 *               Must be ≥ 4 to produce a meaningful result.
 */
export function truncateMiddle(text: string, maxLen: number): string {
  if (maxLen < 4) return text;
  if (text.length <= maxLen) return text;

  // Reserve one char for "…"; split the remaining budget between start/end.
  const budget = maxLen - 1; // subtract 1 for the ellipsis character
  const endLen = Math.floor(budget / 2);
  const startLen = budget - endLen; // start gets the extra char when budget is odd

  const start = text.slice(0, startLen);
  const end = text.slice(text.length - endLen);
  return `${start}\u2026${end}`; // U+2026 HORIZONTAL ELLIPSIS
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BreadcrumbLink({
  item,
  displayLabel,
}: {
  item: BreadcrumbItem;
  /** Pre-computed visible label (may be truncated). Full label lives in title/aria-label. */
  displayLabel: string;
}) {
  if (item.isCurrent) {
    return (
      <span
        className="breadcrumb-current"
        aria-current="page"
        // Always expose the full label to assistive technology
        aria-label={item.label}
        title={item.label}
      >
        {displayLabel}
      </span>
    );
  }

  return (
    <a
      className="breadcrumb-link link-nav"
      href={item.href}
      // Always expose the full label to assistive technology
      aria-label={item.label}
      title={item.label}
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function Breadcrumb({
  items,
  middleEllipsis = false,
  middleEllipsisMaxLen = 24,
}: BreadcrumbProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const ellipsisButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const middleItems = useMemo(() => items.slice(1, -1), [items]);
  const shouldCollapseMiddle = middleItems.length > 0;

  /**
   * Compute the visible display label for each item.
   * When middleEllipsis is enabled, labels longer than middleEllipsisMaxLen
   * are shortened using the middle-ellipsis pattern. The full label is still
   * available via the title attribute and aria-label.
   */
  const displayLabels = useMemo(
    () =>
      items.map((item) =>
        middleEllipsis
          ? truncateMiddle(item.label, middleEllipsisMaxLen)
          : item.label,
      ),
    [items, middleEllipsis, middleEllipsisMaxLen],
  );

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

          /*
           * Middle-ellipsis crumb labels.
           *
           * When the middleEllipsis prop is active, the truncation is handled
           * in JS (truncateMiddle). We still keep overflow:hidden + text-overflow
           * as a CSS safety net for edge cases (e.g. extremely narrow containers),
           * but the primary visual treatment is the JS-computed "start…end" string.
           */
          .breadcrumb-link--middle-ellipsis,
          .breadcrumb-current--middle-ellipsis {
            /* Allow the truncated text to breathe – no hard CSS cut-off needed
               because JS already shortened it. Disable the CSS ellipsis so we
               never see a double-truncation artefact ("start…en…"). */
            text-overflow: clip;
            /* Keep nowrap so the label still sits on one line. */
            white-space: nowrap;
            overflow: hidden;
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
          const displayLabel = displayLabels[index];
          const isTruncated = middleEllipsis && displayLabel !== item.label;

          if (isMiddle) {
            return (
              <li className="breadcrumb-item breadcrumb-middle" key={item.href}>
                <BreadcrumbLink
                  item={item}
                  displayLabel={displayLabel}
                />
                <BreadcrumbSeparator />
              </li>
            );
          }

          return (
            <li
              className={`breadcrumb-item ${isFirst ? "breadcrumb-first" : ""}`}
              key={item.href}
            >
              {item.isCurrent ? (
                <span
                  className={`breadcrumb-current${isTruncated ? " breadcrumb-current--middle-ellipsis" : ""}`}
                  aria-current="page"
                  aria-label={item.label}
                  title={item.label}
                  data-truncated={isTruncated ? "true" : undefined}
                >
                  {displayLabel}
                </span>
              ) : (
                <a
                  className={`breadcrumb-link link-nav${isTruncated ? " breadcrumb-link--middle-ellipsis" : ""}`}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  data-truncated={isTruncated ? "true" : undefined}
                >
                  {displayLabel}
                </a>
              )}
              {isFirst && shouldCollapseMiddle && (
                <span className="breadcrumb-collapsed">
                  <BreadcrumbSeparator />
                  {/* Tooltip wraps the icon-only ellipsis button so
                      keyboard/mouse/touch users all get a visible label.
                      hoverDelayMs prevents accidental flashes during fast
                      cursor movement; longPressMs satisfies touch UX. */}
                  <Tooltip
                    content="Show hidden pages"
                    hoverDelayMs={300}
                    longPressMs={500}
                  >
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
                  </Tooltip>
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
                        {middleItems.map((middleItem) => (
                          <li key={middleItem.href} role="none">
                            <a
                              className="breadcrumb-popover-link link-nav"
                              href={middleItem.href}
                              role="menuitem"
                              // Always show full label inside the popover —
                              // there is no space constraint here.
                              title={middleItem.label}
                            >
                              {middleItem.label}
                            </a>
                          </li>
                        ))}
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
