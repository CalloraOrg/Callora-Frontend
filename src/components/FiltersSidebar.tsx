import React from "react";
import { WarningIcon, ChevronIcon } from "./icons";
import { usePersistedState } from "../hooks/usePersistedState";

export const ALL_CATEGORIES = [
  "Data & Analytics",
  "Payment Processing",
  "Communication",
  "AI/ML",
  "Other",
];

interface FilterGroupProps {
  title: string;
  storageKey: "categories" | "price" | "popularity";
  children: React.ReactNode;
}

function FilterGroup({ title, storageKey, children }: FilterGroupProps) {
  const [collapsed, setCollapsed] = usePersistedState<boolean>(
    `callora.filters.${storageKey}.collapsed`,
    false,
  );

  const handleToggle = () => setCollapsed(!collapsed);

  return (
    <div
      className={`filter-group ${collapsed ? "filter-group--collapsed" : ""}`}
      style={{ marginBottom: 12 }}
    >
      <button
        type="button"
        className="filter-group__header"
        onClick={handleToggle}
        aria-expanded={!collapsed}
        aria-controls={`filter-panel-${storageKey}`}
      >
        <span className="filter-group__title">{title}</span>
        <ChevronIcon
          size={20}
          className={`filter-group__chevron ${collapsed ? "filter-group__chevron--collapsed" : ""}`}
        />
      </button>
      <div
        id={`filter-panel-${storageKey}`}
        className="filter-group__panel"
        hidden={collapsed}
        style={{ marginTop: 8 }}
        data-testid={`filter-panel-${storageKey}`}
      >
        {children}
      </div>
    </div>
  );
}

export default function FiltersSidebar({
  selectedCategories,
  toggleCategory,
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  popularity,
  setPopularity,
  clearFilters,
}: {
  selectedCategories: Set<string>;
  toggleCategory: (c: string) => void;
  minPrice: number | null;
  maxPrice: number | null;
  setMinPrice: (v: number | null) => void;
  setMaxPrice: (v: number | null) => void;
  popularity: string;
  setPopularity: (p: string) => void;
  clearFilters: () => void;
}) {
  return (
    <aside className="filters-sidebar">
      <FilterGroup title="Categories" storageKey="categories">
        <div className="filter-options" style={{ display: "grid", gap: 8 }}>
          {ALL_CATEGORIES.map((c) => {
            const id = `category-${c.replace(/\s+/g, '-').toLowerCase()}`;
            return (
              <div key={c} className="filter-option" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  id={id}
                  type="checkbox"
                  className="filter-checkbox"
                  checked={selectedCategories.has(c)}
                  onChange={() => toggleCategory(c)}
                />
                <label htmlFor={id} className="filter-label" style={{ color: "var(--text)" }}>{c}</label>
              </div>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Price range" storageKey="price">
        <div className="filter-price" style={{ display: "flex", gap: 8 }}>
          <input
            id="min-price-input"
            type="number"
            min="0"
            className={`filter-input ${minPrice !== null && maxPrice !== null && minPrice > maxPrice ? 'filter-input--invalid' : ''}`}
            placeholder="min"
            value={minPrice ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : Math.max(0, Number(e.target.value));
              setMinPrice(val);
            }}
            aria-invalid={minPrice !== null && maxPrice !== null && minPrice > maxPrice}
            aria-describedby={minPrice !== null && maxPrice !== null && minPrice > maxPrice ? "price-range-error" : undefined}
            style={{ width: "100%" }}
          />
          <input
            id="max-price-input"
            type="number"
            min="0"
            className={`filter-input ${minPrice !== null && maxPrice !== null && minPrice > maxPrice ? 'filter-input--invalid' : ''}`}
            placeholder="max"
            value={maxPrice ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : Math.max(0, Number(e.target.value));
              setMaxPrice(val);
            }}
            aria-invalid={minPrice !== null && maxPrice !== null && minPrice > maxPrice}
            aria-describedby={minPrice !== null && maxPrice !== null && minPrice > maxPrice ? "price-range-error" : undefined}
            style={{ width: "100%" }}
          />
        </div>
        {minPrice !== null && maxPrice !== null && minPrice > maxPrice && (
          <div 
            id="price-range-error" 
            style={{ 
              color: "var(--danger)", 
              fontSize: "0.8rem", 
              marginTop: 6, 
              display: "flex", 
              alignItems: "center", 
              gap: 4 
            }}
            role="alert"
          >
            <WarningIcon size={16} /> Min price cannot exceed max price.
          </div>
        )}
      </FilterGroup>

      <FilterGroup title="Popularity" storageKey="popularity">
        <select
          className="filter-select"
          value={popularity}
          onChange={(e) => setPopularity(e.target.value)}
        >
          <option value="any">Any</option>
          <option value="mostUsed">Most used</option>
          <option value="newest">Newest</option>
        </select>
      </FilterGroup>

      <div style={{ marginTop: 8 }}>
        <button className="ghost-button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    </aside>
  );
}