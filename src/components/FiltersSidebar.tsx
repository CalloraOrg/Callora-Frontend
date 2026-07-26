import { WarningIcon, ChevronIcon } from "./icons";
import Dropdown from "./Dropdown";
import EmptyState from "./EmptyState";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { FiltersSidebarSkeleton } from "./Skeleton";
import LiveRegion from "./LiveRegion";

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

export const STATUS_OPTIONS = [
  { value: "operational", label: "Operational" },
  { value: "degraded", label: "Degraded" },
  { value: "maintenance", label: "Maintenance" },
  { value: "down", label: "Down" },
] as const;

interface FilterGroupProps {
  title: string;
  storageKey: "categories" | "price" | "popularity" | "favorites" | "status";
  prefersReducedMotion: boolean;
  children: React.ReactNode;
}

function FilterGroup({
  title,
  storageKey,
  children,
  prefersReducedMotion,
}: FilterGroupProps) {
  const [collapsed, setCollapsed] = usePersistedState<boolean>(
    `callora.filters.${storageKey}.collapsed`,
    false,
  );

  const handleToggle = () => setCollapsed(!collapsed);

  return (
    <div
      className={`filter-group ${collapsed ? "filter-group--collapsed" : ""}`}
      style={{ marginBottom: "var(--mkt-space-lg, 12px)" }}
    >
      <button
        type="button"
        className="filter-group__header"
        onClick={handleToggle}
        aria-expanded={!collapsed}
        aria-controls={`filter-panel-${storageKey}`}
        style={{ transition: prefersReducedMotion ? "none" : undefined }}
      >
        <span className="filter-group__title">{title}</span>
        <ChevronIcon
          size={20}
          className={`filter-group__chevron ${collapsed ? "filter-group__chevron--collapsed" : ""}`}
          style={{ transition: prefersReducedMotion ? "none" : undefined }}
        />
      </button>
      <div
        id={`filter-panel-${storageKey}`}
        className="filter-group__panel"
        hidden={collapsed}
        style={{ marginTop: "var(--mkt-space-md, 8px)" }}
        data-testid={`filter-panel-${storageKey}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Build a human-readable summary of active filters for assistive-tech announcements. */
function buildFilterSummary(params: {
  selectedCategories: Set<string>;
  minPrice: number | null;
  maxPrice: number | null;
  popularity: string;
  favoritesOnly: boolean;
}): string {
  const parts: string[] = [];
  const { selectedCategories, minPrice, maxPrice, popularity, favoritesOnly } = params;

  if (selectedCategories.size > 0) {
    const cats = [...selectedCategories].join(", ");
    parts.push(`${selectedCategories.size} categor${selectedCategories.size === 1 ? "y" : "ies"}: ${cats}`);
  }
  if (minPrice !== null) {
    parts.push(`min price $${minPrice}`);
  }
  if (maxPrice !== null) {
    parts.push(`max price $${maxPrice}`);
  }
  if (popularity !== "any") {
    const label = POPULARITY_OPTIONS.find((o) => o.value === popularity)?.label ?? popularity;
    parts.push(`popularity: ${label}`);
  }
  if (favoritesOnly) {
    parts.push("favorites only");
  }

  return parts.length > 0 ? `Filters active: ${parts.join("; ")}.` : "";
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
  selectedStatuses = new Set<string>(),
  toggleStatus = () => {},
  resultCount,
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
  selectedStatuses?: Set<string>;
  toggleStatus?: (s: string) => void;
  resultCount?: number;
}) {
  const prefersReducedMotion = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Inverted price range — show a warning without silently discarding filters.
  const hasPriceRangeError = minPrice !== null && maxPrice !== null && minPrice > maxPrice;

  const hasActiveFilters =
    selectedCategories.size > 0 ||
    minPrice !== null ||
    maxPrice !== null ||
    popularity !== "any" ||
    favoritesOnly ||
    selectedStatuses.size > 0;

  const [sheetOpen, setSheetOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (sheetOpen) {
      // set focus to close button for basic accessibility
      closeButtonRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setSheetOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [sheetOpen]);

  // ── Aria-live announcements ─────────────────────────────────────────────
  // Track filter state to build descriptive announcements for screen readers.
  // Initialize refs with neutral defaults so the first effect run detects the
  // initial filter values and announces them.
  const prevCategoriesRef = useRef<Set<string>>(new Set());
  const prevMinRef = useRef<number | null>(null);
  const prevMaxRef = useRef<number | null>(null);
  const prevPopularityRef = useRef<string>("any");
  const prevFavoritesRef = useRef<boolean>(false);

  const [announcement, setAnnouncement] = useState("");

  // Announce filter changes when any filter value changes.
  useEffect(() => {
    const catChanged = selectedCategories.size !== prevCategoriesRef.current.size ||
      ![...selectedCategories].every((c) => prevCategoriesRef.current.has(c));
    const minChanged = minPrice !== prevMinRef.current;
    const maxChanged = maxPrice !== prevMaxRef.current;
    const popChanged = popularity !== prevPopularityRef.current;
    const favChanged = favoritesOnly !== prevFavoritesRef.current;

    if (!catChanged && !minChanged && !maxChanged && !popChanged && !favChanged) return;

    // Determine what changed for a specific announcement.
    if (catChanged) {
      const added = [...selectedCategories].filter((c) => !prevCategoriesRef.current.has(c));
      const removed = [...prevCategoriesRef.current].filter((c) => !selectedCategories.has(c));
      if (added.length === 1) {
        setAnnouncement(`Category "${added[0]}" selected. ${buildFilterSummary({ selectedCategories, minPrice, maxPrice, popularity, favoritesOnly })}`);
      } else if (removed.length === 1) {
        setAnnouncement(`Category "${removed[0]}" deselected. ${buildFilterSummary({ selectedCategories, minPrice, maxPrice, popularity, favoritesOnly })}`);
      } else {
        setAnnouncement(buildFilterSummary({ selectedCategories, minPrice, maxPrice, popularity, favoritesOnly }));
      }
    } else if (minChanged || maxChanged) {
      const summary = buildFilterSummary({ selectedCategories, minPrice, maxPrice, popularity, favoritesOnly });
      setAnnouncement(summary || "Price range cleared.");
    } else if (popChanged) {
      const label = POPULARITY_OPTIONS.find((o) => o.value === popularity)?.label ?? popularity;
      setAnnouncement(`Popularity filter set to ${label}. ${buildFilterSummary({ selectedCategories, minPrice, maxPrice, popularity, favoritesOnly })}`);
    } else if (favChanged) {
      setAnnouncement(favoritesOnly ? "Favorites only filter enabled." : "Favorites only filter disabled.");
    }

    prevCategoriesRef.current = new Set(selectedCategories);
    prevMinRef.current = minPrice;
    prevMaxRef.current = maxPrice;
    prevPopularityRef.current = popularity;
    prevFavoritesRef.current = favoritesOnly;
  }, [selectedCategories, minPrice, maxPrice, popularity, favoritesOnly]);

  /** Wrapped clear-filters handler that announces the action. */
  const handleClearFilters = useCallback(() => {
    clearFilters();
    setAnnouncement("All filters cleared. Showing all APIs.");
  }, [clearFilters]);



  // Announce zero results separately from filter changes.
  const prevResultCountRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (resultCount === 0 && prevResultCountRef.current !== 0 && hasActiveFilters) {
      setAnnouncement("No APIs match the current filters. Try adjusting or clearing filters.");
    }
    prevResultCountRef.current = resultCount;
  }, [resultCount, hasActiveFilters]);

  // For responsive styling, `.mobile-filters-toggle` is hidden by desktop CSS
  const content = (
    <>
      {/* ── Categories ────────────────────────────────────────────────── */}
      <FilterGroup
        title="Categories"
        storageKey="categories"
        prefersReducedMotion={prefersReducedMotion}
      >
        <div className="filter-options" style={{ display: "grid", gap: "var(--mkt-space-md, 8px)" }}>
          {ALL_CATEGORIES.map((c) => {
            const id = `category-${c.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <div
                key={c}
                className="filter-option"
                style={{ display: "flex", gap: "var(--mkt-space-md, 8px)", alignItems: "center" }}
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

      {/* ── Price range ────────────────────────────────────────────────── */}
      <FilterGroup
        title="Price range"
        storageKey="price"
        prefersReducedMotion={prefersReducedMotion}
      >
        <div style={{ display: "grid", gap: "var(--mkt-space-md, 8px)" }}>
          <div style={{ display: "flex", gap: "var(--mkt-space-md, 8px)", alignItems: "center" }}>
            <label
              htmlFor="filter-min-price"
              className="filter-label"
              style={{ minWidth: 28 }}
            >
              Min
            </label>
            <input
              id="filter-min-price"
              type="number"
              className={`filter-input${hasPriceRangeError ? " filter-input--invalid" : ""} tabular-nums`}
              value={minPrice ?? ""}
              min={0}
              placeholder="0"
              onChange={(e) =>
                setMinPrice(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              aria-label="Minimum price"
              aria-invalid={hasPriceRangeError}
              aria-describedby={hasPriceRangeError ? "filters-price-error" : undefined}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <div style={{ display: "flex", gap: "var(--mkt-space-md, 8px)", alignItems: "center" }}>
            <label
              htmlFor="filter-max-price"
              className="filter-label"
              style={{ minWidth: 28 }}
            >
              Max
            </label>
            <input
              id="filter-max-price"
              type="number"
              className={`filter-input${hasPriceRangeError ? " filter-input--invalid" : ""} tabular-nums`}
              value={maxPrice ?? ""}
              min={0}
              placeholder="∞"
              onChange={(e) =>
                setMaxPrice(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              aria-label="Maximum price"
              aria-invalid={hasPriceRangeError}
              aria-describedby={hasPriceRangeError ? "filters-price-error" : undefined}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          {hasPriceRangeError && (
            <p
              id="filters-price-error"
              className="error-text"
              role="alert"
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                margin: 0,
              }}
            >
              <WarningIcon size={16} aria-hidden="true" />
              Min price cannot exceed max price
            </p>
          )}
        </div>
      </FilterGroup>

      {/* ── Popularity ─────────────────────────────────────────────────── */}
      <FilterGroup
        title="Popularity"
        storageKey="popularity"
        prefersReducedMotion={prefersReducedMotion}
      >
        <div className="filter-popularity" style={{ marginTop: "var(--mkt-space-md, 8px)" }}>
          <Dropdown<PopularityValue>
            id="filters-popularity"
            value={popularity as PopularityValue}
            options={
              POPULARITY_OPTIONS as unknown as {
                value: PopularityValue;
                label: string;
              }[]
            }
            onChange={(v) => setPopularity(v)}
            label="Filter by popularity"
            visibleLabel={null}
            className="filter-dropdown"
          />
        </div>
      </FilterGroup>

      {/* ── Favorites ──────────────────────────────────────────────────── */}
      <FilterGroup
        title="Favorites"
        storageKey="favorites"
        prefersReducedMotion={prefersReducedMotion}
      >
        <div
          className="filter-option"
          style={{
            display: "flex",
            gap: "var(--mkt-space-md, 8px)",
            alignItems: "center",
            marginTop: "var(--mkt-space-md, 8px)",
          }}
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
      </FilterGroup>

      {/* ── Zero-results illustration (v7) ───────────────────────────────
         Visually separates from the filter groups above with a soft token-
         based top border so the call-to-action feels grouped with the
         result-count feedback rather than with the Favorites section.
         The wrapper is aria-live="polite" so screen readers announce the
         zero-results state when filters narrow the count to 0. */}
      {typeof resultCount === "number" &&
        resultCount === 0 &&
        hasActiveFilters && (
          <div
            data-testid="filters-zero-results"
            style={{
              margin: "var(--mkt-space-lg, 12px) 0",
              paddingTop: "var(--mkt-space-lg, 12px)",
              borderTop: "1px solid var(--line)",
            }}
            role="status"
            aria-live="polite"
          >
            <EmptyState
              variant="filtered"
              size="compact"
              onClearFilters={hasActiveFilters ? handleClearFilters : undefined}
            />
          </div>
        )}

      {/* ── Clear ──────────────────────────────────────────────────────── */}
      <div style={{ marginTop: "var(--mkt-space-md, 8px)" }}>
        <button className="ghost-button" onClick={handleClearFilters}>
          Clear filters
        </button>
      </div>

    </>
  );

  return (
    <aside className="filters-sidebar">
      <button
        type="button"
        className="mobile-filters-toggle"
        aria-controls="filters-sheet"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
      >
        <ChevronIcon size={16} /> Filters
      </button>

      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          id="filters-sheet"
          className="filters-sheet-overlay"
          onClick={() => setSheetOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            zIndex: 1000,
          }}
        >
          <div
            className="filters-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxHeight: "80%",
              background: "var(--surface, #fff)",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              padding: "var(--mkt-space-xl, 16px)",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0 }}>Filters</h2>
              <button
                ref={closeButtonRef}
                aria-label="Close filters"
                onClick={() => setSheetOpen(false)}
              >
                Close
              </button>
            </div>
            {content}
          </div>
        </div>
      )}

      {content}

      {/* Hidden aria-live region for screen-reader announcements —
          rendered once outside the content variable to avoid duplicate
          ids when content appears both inline and inside the sheet. */}
      <LiveRegion
        regionId="filters-sidebar-announcements"
        message={announcement}
      />
    </aside>
  );
}

