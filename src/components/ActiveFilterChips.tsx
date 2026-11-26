import { useEffect, useRef } from "react";

export interface ActiveFilterChipsProps {
  categories: Set<string>;
  statuses?: Set<string>;
  tag?: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  popularity: string;
  favoritesOnly: boolean;
  onRemoveCategory: (c: string) => void;
  onRemoveStatus?: (s: string) => void;
  onRemoveTag?: () => void;
  onRemoveMinPrice: () => void;
  onRemoveMaxPrice: () => void;
  onRemovePopularity: () => void;
  onRemoveFavoritesOnly: () => void;
  onClearAll: () => void;
  resultsHeadingRef?: React.RefObject<HTMLElement | null>;
}

export default function ActiveFilterChips({
  categories,
  statuses = new Set(),
  tag = null,
  minPrice,
  maxPrice,
  popularity,
  favoritesOnly,
  onRemoveCategory,
  onRemoveStatus,
  onRemoveTag,
  onRemoveMinPrice,
  onRemoveMaxPrice,
  onRemovePopularity,
  onRemoveFavoritesOnly,
  onClearAll,
  resultsHeadingRef,
}: ActiveFilterChipsProps) {
  const chips: {
    key: string;
    label: string;
    ariaLabel: string;
    onRemove: () => void;
    inactive?: boolean;
    title?: string;
  }[] = [];

  const pendingRemovalIndexRef = useRef<number | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // An inverted range makes the page skip price filtering entirely, so the
  // price chips stay visible (the values are still set) but are flagged as not
  // actually narrowing the results.
  const priceInactive = minPrice !== null && maxPrice !== null && minPrice > maxPrice;
  const inactivePriceTitle = "Min price exceeds max price; price filter is inactive";

  categories.forEach((c) => {
    chips.push({
      key: `cat-${c}`,
      label: `Category: ${c}`,
      ariaLabel: `Remove filter: Category ${c}`,
      onRemove: () => onRemoveCategory(c),
    });
  });

  if (statuses) {
    statuses.forEach((s) => {
      const statusLabel = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      chips.push({
        key: `status-${s}`,
        label: `Status: ${statusLabel}`,
        ariaLabel: `Remove filter: Status ${statusLabel}`,
        onRemove: () => onRemoveStatus?.(s),
      });
    });
  }

  if (tag) {
    chips.push({
      key: "tag",
      label: `Tag: ${tag}`,
      ariaLabel: `Remove filter: Tag ${tag}`,
      onRemove: () => onRemoveTag?.(),
    });
  }

  if (minPrice !== null) {
    chips.push({
      key: "minPrice",
      label: `Min price: $${minPrice}`,
      ariaLabel: `Remove filter: Min price $${minPrice}`,
      onRemove: onRemoveMinPrice,
      inactive: priceInactive,
      title: priceInactive ? inactivePriceTitle : undefined,
    });
  }

  if (maxPrice !== null) {
    chips.push({
      key: "maxPrice",
      label: `Max price: $${maxPrice}`,
      ariaLabel: `Remove filter: Max price $${maxPrice}`,
      onRemove: onRemoveMaxPrice,
      inactive: priceInactive,
      title: priceInactive ? inactivePriceTitle : undefined,
    });
  }

  if (popularity !== "any") {
    chips.push({
      key: "popularity",
      label: `Popularity: ${popularity}`,
      ariaLabel: `Remove filter: Popularity ${popularity}`,
      onRemove: onRemovePopularity,
    });
  }

  if (favoritesOnly) {
    chips.push({
      key: "favorites",
      label: "Favorites only",
      ariaLabel: "Remove filter: Favorites only",
      onRemove: onRemoveFavoritesOnly,
    });
  }

  useEffect(() => {
    if (pendingRemovalIndexRef.current !== null) {
      const targetIndex = pendingRemovalIndexRef.current;
      pendingRemovalIndexRef.current = null;

      if (chips.length > 0) {
        const nextIndex = Math.min(targetIndex, chips.length - 1);
        const nextKey = chips[nextIndex]?.key;
        if (nextKey) {
          const btn = buttonRefs.current.get(nextKey);
          btn?.focus();
        }
      } else {
        if (resultsHeadingRef?.current) {
          resultsHeadingRef.current.focus();
        } else {
          const heading = document.querySelector<HTMLElement>(
            'h2, h1, [role="heading"], .marketplace-count'
          );
          heading?.focus();
        }
      }
    }
  });

  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      className="active-filter-chips"
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: "16px",
      }}
    >
      {chips.map((chip, index) => (
        <div
          key={chip.key}
          className={`filter-chip${chip.inactive ? " filter-chip--inactive" : ""}`}
          data-testid={`filter-chip-${chip.key}`}
          data-inactive={chip.inactive ? "true" : "false"}
          title={chip.title}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 12px",
            background: "var(--surface-soft)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            fontSize: "0.875rem",
            color: "var(--text)",
            height: "32px",
            ...(chip.inactive
              ? { opacity: 0.7, borderStyle: "dashed" as const }
              : null),
          }}
        >
          <span>
            {chip.label}
            {chip.inactive && (
              <span className="filter-chip__inactive-note"> (not applied)</span>
            )}
          </span>
          <button
            ref={(el) => {
              if (el) buttonRefs.current.set(chip.key, el);
              else buttonRefs.current.delete(chip.key);
            }}
            type="button"
            onClick={() => {
              pendingRemovalIndexRef.current = index;
              chip.onRemove();
            }}
            aria-label={chip.ariaLabel}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              margin: "-6px -12px -6px -4px",
              fontSize: "1.25rem",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      ))}
      {chips.length > 0 && (
        <button
          type="button"
          onClick={() => {
            pendingRemovalIndexRef.current = 0;
            onClearAll();
          }}
          className="ghost-button"
          style={{ fontSize: "0.875rem", padding: "4px 12px" }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
