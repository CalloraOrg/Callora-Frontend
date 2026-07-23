import { WarningIcon, ChevronIcon } from "./icons";
import { usePersistedState } from "../hooks/usePersistedState";
import Dropdown from "./Dropdown";

const POPULARITY_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "mostUsed", label: "Most used" },
  { value: "newest", label: "Newest" },
] as const;

type PopularityValue = (typeof POPULARITY_OPTIONS)[number]["value"];

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
  favoritesOnly = false,
  toggleFavoritesOnly = () => {},
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
  favoritesOnly?: boolean;
  toggleFavoritesOnly?: () => void;
}) {
  const priceError =
    minPrice !== null && maxPrice !== null && minPrice > maxPrice;

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
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              id="filter-min-price"
              type="number"
              min="0"
              placeholder="Min"
              className="filter-input"
              style={{
                width: "100%",
                padding: "0.5rem 0.6rem",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                background: "var(--surface)",
                color: "var(--text)",
              }}
              value={minPrice ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setMinPrice(v === "" ? null : Number(v));
              }}
              aria-label="Minimum price"
            />
            <span style={{ color: "var(--muted)" }}>–</span>
            <input
              id="filter-max-price"
              type="number"
              min="0"
              placeholder="Max"
              className="filter-input"
              style={{
                width: "100%",
                padding: "0.5rem 0.6rem",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                background: "var(--surface)",
                color: "var(--text)",
              }}
              value={maxPrice ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setMaxPrice(v === "" ? null : Number(v));
              }}
              aria-label="Maximum price"
            />
          </div>
          {priceError && (
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                color: "var(--danger)",
                fontSize: "0.8rem",
              }}
            >
              <WarningIcon size={16} />
              <span>Min price cannot exceed max price</span>
            </div>
          )}
        </div>
      </FilterGroup>

      <FilterGroup title="Popularity" storageKey="popularity">
        <div style={{ marginTop: 0 }}>
          <Dropdown<PopularityValue>
            id="filters-popularity"
            value={popularity as PopularityValue}
            options={POPULARITY_OPTIONS as unknown as { value: PopularityValue; label: string }[]}
            onChange={(v) => setPopularity(v)}
            label="Filter by popularity"
            visibleLabel={null}
            className="filter-dropdown"
          />
        </div>
      </FilterGroup>

      <div style={{ marginBottom: 12 }}>
        <fieldset className="filter-group">
          <legend className="filter-legend">Favorites</legend>
          <div className="filter-option" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              id="favorites-only-checkbox"
              type="checkbox"
              className="filter-checkbox"
              checked={favoritesOnly}
              onChange={toggleFavoritesOnly}
            />
            <label htmlFor="favorites-only-checkbox" className="filter-label" style={{ color: "var(--text)" }}>
              Favorites only
            </label>
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
