import React from 'react';

interface ActiveFilterChipsProps {
  categories: Set<string>;
  minPrice: number | null;
  maxPrice: number | null;
  popularity: string;
  favoritesOnly: boolean;
  onRemoveCategory: (c: string) => void;
  onRemoveMinPrice: () => void;
  onRemoveMaxPrice: () => void;
  onRemovePopularity: () => void;
  onRemoveFavoritesOnly: () => void;
  onClearAll: () => void;
}

export default function ActiveFilterChips({
  categories,
  minPrice,
  maxPrice,
  popularity,
  favoritesOnly,
  onRemoveCategory,
  onRemoveMinPrice,
  onRemoveMaxPrice,
  onRemovePopularity,
  onRemoveFavoritesOnly,
  onClearAll,
}: ActiveFilterChipsProps) {
  const chips: {
    key: string;
    label: string;
    onRemove: () => void;
    inactive?: boolean;
  }[] = [];

  // An inverted range makes the page skip price filtering entirely, so the
  // price chips stay visible (the values are still set) but are flagged as not
  // actually narrowing the results.
  const priceInactive = minPrice !== null && maxPrice !== null && minPrice > maxPrice;

  categories.forEach((c) => {
    chips.push({
      key: `cat-${c}`,
      label: `Category: ${c}`,
      onRemove: () => onRemoveCategory(c),
    });
  });

  if (minPrice !== null) {
    chips.push({
      key: 'minPrice',
      label: `Min price: $${minPrice}`,
      onRemove: onRemoveMinPrice,
      inactive: priceInactive,
    });
  }

  if (maxPrice !== null) {
    chips.push({
      key: 'maxPrice',
      label: `Max price: $${maxPrice}`,
      onRemove: onRemoveMaxPrice,
      inactive: priceInactive,
    });
  }

  if (popularity !== 'any') {
    chips.push({
      key: 'popularity',
      label: `Popularity: ${popularity}`,
      onRemove: onRemovePopularity,
    });
  }

  if (favoritesOnly) {
    chips.push({
      key: 'favorites',
      label: 'Favorites only',
      onRemove: onRemoveFavoritesOnly,
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="active-filter-chips" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
      {chips.map((chip) => (
        <div
          key={chip.key}
          className={`filter-chip${chip.inactive ? ' filter-chip--inactive' : ''}`}
          data-testid={`filter-chip-${chip.key}`}
          data-inactive={chip.inactive ? 'true' : 'false'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            background: 'var(--surface-soft)',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            fontSize: '0.875rem',
            color: 'var(--text)',
            height: '32px',
            ...(chip.inactive
              ? { opacity: 0.7, borderStyle: 'dashed' as const }
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
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter ${chip.label}`}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              margin: '-6px -12px -6px -4px',
              fontSize: '1.25rem',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      ))}
      {chips.length >= 2 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ghost-button"
          style={{ fontSize: '0.875rem', padding: '4px 12px' }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
