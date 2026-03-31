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
    <aside style={{ width: 320 }}>
      <div style={{ marginBottom: 12 }}>
        <strong>Categories</strong>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {ALL_CATEGORIES.map((c) => (
            <label
              key={c}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                type="checkbox"
                checked={selectedCategories.has(c)}
                onChange={() => toggleCategory(c)}
              />
              <span style={{ color: "var(--muted)" }}>{c}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Price range</strong>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <input
            type="number"
            placeholder="min"
            value={minPrice ?? ""}
            onChange={(e) =>
              setMinPrice(e.target.value === "" ? null : Number(e.target.value))
            }
            style={{ width: "100%" }}
          />
          <input
            type="number"
            placeholder="max"
            value={maxPrice ?? ""}
            onChange={(e) =>
              setMaxPrice(e.target.value === "" ? null : Number(e.target.value))
            }
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Popularity</strong>
        <div style={{ marginTop: 8 }}>
          <select
            value={popularity}
            onChange={(e) => setPopularity(e.target.value)}
          >
            <option value="any">Any</option>
            <option value="mostUsed">Most used</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button className="ghost-button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    </aside>
  );
}
