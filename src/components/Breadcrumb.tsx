import { useEffect, useId, useMemo, useState } from "react";

type BreadcrumbItem = {
  label: string;
  href: string;
  isCurrent?: boolean;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

function BreadcrumbLink({ item }: { item: BreadcrumbItem }) {
  if (item.isCurrent) {
    return (
      <span
        className="breadcrumb-current"
        aria-current="page"
        title={item.label}
      >
        {item.label}
      </span>
    );
  }

  return (
    <a className="breadcrumb-link" href={item.href} title={item.label}>
      {item.label}
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

export default function Breadcrumb({ items }: BreadcrumbProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverId = useId();
  const middleItems = useMemo(() => items.slice(1, -1), [items]);
  const shouldCollapseMiddle = middleItems.length > 0;

  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverOpen]);

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
            text-decoration: none;
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

          if (isMiddle) {
            return (
              <li className="breadcrumb-item breadcrumb-middle" key={item.href}>
                <BreadcrumbLink item={item} />
                <BreadcrumbSeparator />
              </li>
            );
          }

          return (
            <li
              className={`breadcrumb-item ${isFirst ? "breadcrumb-first" : ""}`}
              key={item.href}
            >
              <BreadcrumbLink item={item} />
              {isFirst && shouldCollapseMiddle && (
                <span className="breadcrumb-collapsed">
                  <BreadcrumbSeparator />
                  <button
                    type="button"
                    className="breadcrumb-ellipsis"
                    aria-label="Show collapsed breadcrumb items"
                    aria-expanded={isPopoverOpen}
                    aria-controls={popoverId}
                    onClick={() => setIsPopoverOpen((open) => !open)}
                  >
                    ...
                  </button>
                  {isPopoverOpen && (
                    <div
                      className="breadcrumb-popover"
                      id={popoverId}
                      role="menu"
                    >
                      <ol className="breadcrumb-popover-list">
                        {middleItems.map((middleItem) => (
                          <li key={middleItem.href} role="none">
                            <a
                              className="breadcrumb-popover-link"
                              href={middleItem.href}
                              role="menuitem"
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
