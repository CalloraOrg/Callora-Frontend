export const ALL_CATEGORIES = [
  "Data & Analytics",
  "Payment Processing",
  "Communication",
  "AI/ML",
  "Other",
];

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
      <div style={{ marginBottom: 12 }}>
          <fieldset className="filter-group">
            <legend className="filter-legend">Categories</legend>
            <div className="filter-options" style={{ marginTop: 8, display: "grid", gap: 8 }}>
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
          </fieldset>
      </div>

      <div style={{ marginBottom: 12 }}>
          <fieldset className="filter-group">
            <legend className="filter-legend">Price range</legend>
            <div className="filter-price" style={{ marginTop: 8, display: "flex", gap: 8 }}>
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
                <span>⚠️</span> Min price cannot exceed max price.
              </div>
            )}
          </fieldset>
      </div>

      <div style={{ marginBottom: 12 }}>
          <fieldset className="filter-group">
            <legend className="filter-legend">Popularity</legend>
            <div className="filter-popularity" style={{ marginTop: 8 }}>
              <select
                className="filter-select"
                value={popularity}
                onChange={(e) => setPopularity(e.target.value)}
              >
                <option value="any">Any</option>
                <option value="mostUsed">Most used</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </fieldset>
      </div>

      <div style={{ marginTop: 8 }}>
        <button className="ghost-button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    </aside>
  );
}
