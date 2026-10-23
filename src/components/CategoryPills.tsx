import React from 'react';

interface CategoryPillsProps {
  categories: readonly string[];
  selectedCategories: Set<string>;
  toggleCategory: (category: string) => void;
  clearCategories: () => void;
}

export default function CategoryPills({
  categories,
  selectedCategories,
  toggleCategory,
  clearCategories
}: CategoryPillsProps) {
  const isAllSelected = selectedCategories.size === 0;

  return (
    <div className="pill-bar" role="group" aria-label="Filter by category">
      <button
        type="button"
        className={`pill-bar__item ${isAllSelected ? 'pill-bar__item--active' : ''}`}
        aria-pressed={isAllSelected}
        onClick={clearCategories}
      >
        All
      </button>
      {categories.map((c) => {
        const isActive = selectedCategories.has(c);
        return (
          <button
            key={c}
            type="button"
            className={`pill-bar__item ${isActive ? 'pill-bar__item--active' : ''}`}
            aria-pressed={isActive}
            onClick={() => toggleCategory(c)}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
