import { WarningIcon, ChevronIcon } from "./icons";
import Dropdown from "./Dropdown";
import { usePersistedState } from "../hooks/usePersistedState";

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
  favoritesOnly,
  toggleFavoritesOnly,
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
  favoritesOnly: boolean;
  toggleFavoritesOnly: () => void;
}) {
  // Inverted price range — show a warning without silently discarding filters.
  const hasPriceRangeError =
    minPrice !== null && maxPrice !== null && minPrice > maxPrice;

  return (
    <aside className="filters-sidebar">
      {/* ── Categories ──────────────────────────────────────────────────── */}
      <FilterGroup title="Categories" storageKey="categories">
        <div className="filter-options" style={{ display: "grid", gap: 8 }}>
          {ALL_CATEGORIES.map((c) => {
            const id = `category-${c.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <div
                key={c}
                className="filter-option"
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  id={id}
                  type="checkbox"
                  className="filter-checkbox"
                  checked={selectedCategories.has(c)}
                  onChange={() => toggleCategory(c)}
                />
                <label
                  htmlFor={id}
                  className="filter-label"
                  style={{ color: "var(--text)" }}
                >
                  {c}
                </label>
              </div>
            );
          })}
        </div>
      </FilterGroup>

      {/* ── Price range ─────────────────────────────────────────────────── */}
      <FilterGroup title="Price range" storageKey="price">
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="filter-min-price" className="filter-label" style={{ minWidth: 28 }}>
              Min
            </label>
            <input
              id="filter-min-price"
              type="number"
              className={`filter-input${hasPriceRangeError ? " filter-input--invalid" : ""}`}
              value={minPrice ?? ""}
              min={0}
              placeholder="0"
              onChange={(e) =>
                setMinPrice(e.target.value === "" ? null : Number(e.target.value))
              }
              aria-label="Minimum price"
              aria-invalid={hasPriceRangeError}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="filter-max-price" className="filter-label" style={{ minWidth: 28 }}>
              Max
            </label>
            <input
              id="filter-max-price"
              type="number"
              className={`filter-input${hasPriceRangeError ? " filter-input--invalid" : ""}`}
              value={maxPrice ?? ""}
              min={0}
              placeholder="∞"
              onChange={(e) =>
                setMaxPrice(e.target.value === "" ? null : Number(e.target.value))
              }
              aria-label="Maximum price"
              aria-invalid={hasPriceRangeError}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          {hasPriceRangeError && (
            <p
              className="error-text"
              role="alert"
              style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}
            >
              <WarningIcon size={16} aria-hidden="true" />
              Min price cannot exceed max price
            </p>
          )}
        </div>
      </FilterGroup>

      {/* ── Popularity ──────────────────────────────────────────────────── */}
      <FilterGroup title="Popularity" storageKey="popularity">
        <div className="filter-popularity" style={{ marginTop: 4 }}>
          <Dropdown<PopularityValue>
            id="filters-popularity"
            value={popularity as PopularityValue}
            options={
              POPULARITY_OPTIONS as unknown as { value: PopularityValue; label: string }[]
            }
            onChange={(v) => setPopularity(v)}
            label="Filter by popularity"
            visibleLabel={null}
            className="filter-dropdown"
          />
        </div>
      </FilterGroup>

      {/* ── Favorites ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <fieldset className="filter-group">
          <legend className="filter-legend">Favorites</legend>
          <div
            className="filter-option"
            style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}
          >
            <input
              id="favorites-only-checkbox"
              type="checkbox"
              className="filter-checkbox"
              checked={favoritesOnly}
              onChange={toggleFavoritesOnly}
            />
            <label
              htmlFor="favorites-only-checkbox"
              className="filter-label"
              style={{ color: "var(--text)" }}
            >
              Favorites only
            </label>
          </div>
        </fieldset>
      </div>

      {/* ── Clear ───────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 8 }}>
        <button className="ghost-button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    </aside>
  );
}
