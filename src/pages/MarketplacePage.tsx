import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ApiCard from "../components/ApiCard";
import useDocumentTitle from "../hooks/useDocumentTitle";
import SearchBar from "../components/SearchBar";
import SortDropdown, { type SortValue } from "../components/SortDropdown";

import FiltersSidebar from "../components/FiltersSidebar";
import EmptyState from "../components/EmptyState";
import MarketplacePageSkeleton from "./MarketplacePage.skeleton";
import MOCK_APIS, { type APIItem } from "../data/mockApis";
import { useDebounce } from "../hooks/useDebounce";
import { LOADING_DELAY_MS } from "../config/constants";
import {
  readDensityPreference,
  persistDensityPreference,
  type DensityPreference,
} from "../utils/density";

export default function MarketplacePage(): JSX.Element {
  useDocumentTitle(
    "Marketplace – Callora",
    "Explore APIs on the Callora marketplace, discover and integrate APIs for your applications.",
  );
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<DensityPreference>(() =>
    readDensityPreference(),
  );
  // Debounce search input to prevent excessive re-renders on large lists
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [popularity, setPopularity] = useState<string>("any");
  /**
   * Sort state persisted via URL query parameter ?sort=
   * Default is "popularity" to match existing behaviour.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = (searchParams.get("sort") ?? "popularity") as SortValue;
  const setSortParam = (value: SortValue) => {
    setSearchParams(
      (prev) => {
        prev.set("sort", value);
        return prev;
      },
      { replace: true },
    );
  };
  const [shown, setShown] = useState<number>(12);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Ref used to restore focus to the Filters trigger after the sheet closes
  const filtersTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Simulate initial data loading with occasional error for testing
    const timer = setTimeout(() => {
      setIsLoading(false);
      // Uncomment below to test error state
      // setFetchError("Failed to fetch APIs. Please try again.");
    }, LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    persistDensityPreference(density);
  }, [density]);

  const toggleCategory = (c: string) => {
    const copy = new Set(selectedCategories);
    if (copy.has(c)) copy.delete(c);
    else copy.add(c);
    setSelectedCategories(copy);
  };

  const clearFilters = () => {
    setSelectedCategories(new Set());
    setSelectedTag(null);
    setMinPrice(null);
    setMaxPrice(null);
    setPopularity("any");
    setSortParam("popularity");
    setSearch("");
    setShown(12);
  };

  /**
   * Determine if any filters are currently active.
   * Used to distinguish between "no APIs exist" vs "filters too narrow" empty states.
   */
  const hasActiveFilters = () => {
    return (
      search.trim() !== "" ||
      selectedCategories.size > 0 ||
      selectedTag !== null ||
      minPrice !== null ||
      maxPrice !== null ||
      popularity !== "any"
    );
  };

  /**
   * Count of actively-applied filter dimensions — shown as a badge on the
   * mobile Filters trigger button.
   */
  const activeFilterCount =
    selectedCategories.size +
    (minPrice !== null ? 1 : 0) +
    (maxPrice !== null ? 1 : 0) +
    (popularity !== "any" ? 1 : 0);

  /**
   * Handle retry for fetch errors.
   * Clears error state and simulates refetch.
   */
  const handleRetryFetch = async () => {
    setFetchError(null);
    setIsLoading(true);
    // Simulate network request
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsLoading(false);
  };

  const filtered = useMemo(() => {
    let items = MOCK_APIS.slice();

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter((a) => {
        return (
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.provider?.name?.toLowerCase().includes(q) ||
          (a.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    if (selectedCategories.size > 0) {
      items = items.filter((a) => selectedCategories.has(a.category ?? ""));
    }

    if (selectedTag) {
      const normalizedSelectedTag = selectedTag.toLowerCase();
      items = items.filter((a) =>
        (a.tags || []).some(
          (tag) => tag.toLowerCase() === normalizedSelectedTag,
        ),
      );
    }

    const hasInvertedPrice =
      minPrice !== null && maxPrice !== null && minPrice > maxPrice;
    if (!hasInvertedPrice) {
      if (minPrice !== null)
        items = items.filter((a) => a.pricePerRequest >= minPrice);
      if (maxPrice !== null)
        items = items.filter((a) => a.pricePerRequest <= maxPrice);
    }

    // popularity-based ordering
    if (popularity === "mostUsed") {
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    } else if (popularity === "newest") {
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );
    }

    // explicit sort options driven by the URL ?sort= param
    if (sortParam === "price-asc")
      items = items.sort((a, b) => a.pricePerRequest - b.pricePerRequest);
    if (sortParam === "latency-asc")
      items = items.sort(
        (a, b) =>
          (a.stats?.avgResponseMs ?? Number.MAX_SAFE_INTEGER) -
          (b.stats?.avgResponseMs ?? Number.MAX_SAFE_INTEGER),
      );
    if (sortParam === "popularity")
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    if (sortParam === "newest")
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );

    return items;
  }, [
    debouncedSearch,
    selectedCategories,
    selectedTag,
    minPrice,
    maxPrice,
    popularity,
    sortParam,
  ]);

  useEffect(() => {
    setShown(12);
  }, [
    debouncedSearch,
    selectedCategories,
    selectedTag,
    minPrice,
    maxPrice,
    popularity,
    sortParam,
  ]);

  const handleTagClick = (tag: string) => {
    setSelectedTag((currentTag) =>
      currentTag?.toLowerCase() === tag.toLowerCase() ? null : tag,
    );
  };

  const displayedItems = filtered.slice(0, shown);

  const handleViewDetails = (api: APIItem) => {
    history.pushState({}, "", `/details/${api.id}`);
    // inform our small client router that the URL changed
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  if (isLoading) {
    return <MarketplacePageSkeleton />;
  }
  return (
    <div className="marketplace-page">
      {/* Top row: title + search only */}
      <div className="marketplace-header">
        <h1>API Marketplace</h1>
        <div className="marketplace-search-row">
          <div className="marketplace-search">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <div className="marketplace-density-toggle" role="group" aria-label="Results density">
            <button
              type="button"
              className="density-toggle-button"
              aria-pressed={density === "comfortable"}
              onClick={() => setDensity("comfortable")}
            >
              Comfortable
            </button>
            <button
              type="button"
              className="density-toggle-button"
              aria-pressed={density === "compact"}
              onClick={() => setDensity("compact")}
            >
              Compact
            </button>
          </div>
        </div>
        <SortDropdown value={sortParam} onChange={setSortParam} />
      </div>

      {/* Bottom: filters left, content right */}
      <div className="marketplace-layout">
        <aside className="marketplace-sidebar">
          <FiltersSidebar
            selectedCategories={selectedCategories}
            toggleCategory={toggleCategory}
            minPrice={minPrice}
            maxPrice={maxPrice}
            setMinPrice={setMinPrice}
            setMaxPrice={setMaxPrice}
            popularity={popularity}
            setPopularity={setPopularity}
            clearFilters={clearFilters}
          />
        </aside>

        <main className="marketplace-results">
          <div className="marketplace-toolbar">
            <div className="marketplace-count">
              {filtered.length === 0 ? (
                <>Showing 0 of 0 APIs</>
              ) : (
                <>
                  Showing 1-{Math.min(shown, filtered.length)} of{" "}
                  {filtered.length} APIs
                </>
              )}
              {selectedTag && (
                <span className="marketplace-active-tag" aria-live="polite">
                  Filtered by tag: #{selectedTag}
                </span>
              )}
            </div>

            <div className="marketplace-actions">
              <select value={sortParam} onChange={(e) => setSortParam(e.target.value as SortValue)}>
                <option value="relevance">Relevance</option>
                <option value="priceAsc">Price: low → high</option>
                <option value="priceDesc">Price: high → low</option>
                <option value="popularity">Popularity</option>
                <option value="newest">Newest</option>
              </select>

              {/* Mobile Filters trigger — hidden on desktop via CSS */}
              <button
                ref={filtersTriggerRef}
                className="ghost-button marketplace-filter-button"
                onClick={() => setShowFiltersMobile(true)}
                aria-haspopup="dialog"
                aria-expanded={showFiltersMobile}
              >
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="marketplace-filter-badge"
                    aria-label={`${activeFilterCount} active filter${activeFilterCount !== 1 ? "s" : ""}`}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {fetchError ? (
            <EmptyState variant="error" onRetry={handleRetryFetch} />
          ) : filtered.length === 0 ? (
            <EmptyState
              variant={hasActiveFilters() ? "filtered" : "empty"}
              onClearFilters={hasActiveFilters() ? clearFilters : undefined}
            />
          ) : (
            <div className="marketplace-grid">
              {displayedItems.map((a) => (
                <ApiCard
                  key={a.id}
                  api={a}
                  onViewDetails={handleViewDetails}
                  onTagClick={handleTagClick}
                  activeTag={selectedTag}
                />
              ))}
            </div>
          )}

          {filtered.length > shown && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button
                className="primary-button"
                onClick={() => setShown((s) => s + 12)}
              >
                Load more
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom-sheet — only rendered when open */}
      <FiltersBottomSheet
        open={showFiltersMobile}
        onClose={() => setShowFiltersMobile(false)}
        resultCount={filtered.length}
        selectedCategories={selectedCategories}
        toggleCategory={toggleCategory}
        minPrice={minPrice}
        maxPrice={maxPrice}
        setMinPrice={setMinPrice}
        setMaxPrice={setMaxPrice}
        popularity={popularity}
        setPopularity={setPopularity}
        clearFilters={clearFilters}
        triggerRef={filtersTriggerRef}
      />
    </div>
  );
}
