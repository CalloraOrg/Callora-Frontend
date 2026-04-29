import { useEffect, useMemo, useState } from "react";
import ApiCard, { ApiCardSkeleton } from "../components/ApiCard";
import SearchBar from "../components/SearchBar";
import FiltersSidebar from "../components/FiltersSidebar";
import EmptyState from "../components/EmptyState";
import MOCK_APIS, { type APIItem } from "../data/mockApis";

export default function MarketplacePage(): JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [popularity, setPopularity] = useState<string>("any");
  const [sort, setSort] = useState<string>("relevance");
  const [shown, setShown] = useState<number>(12);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial data loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const toggleCategory = (c: string) => {
    const copy = new Set(selectedCategories);
    if (copy.has(c)) copy.delete(c);
    else copy.add(c);
    setSelectedCategories(copy);
  };

  const clearFilters = () => {
    setSelectedCategories(new Set());
    setMinPrice(null);
    setMaxPrice(null);
    setPopularity("any");
    setSort("relevance");
  };

  const filtered = useMemo(() => {
    let items = MOCK_APIS.slice();

    if (search.trim()) {
      const q = search.toLowerCase();
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

    if (minPrice !== null)
      items = items.filter((a) => a.pricePerRequest >= minPrice);
    if (maxPrice !== null)
      items = items.filter((a) => a.pricePerRequest <= maxPrice);

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

    // explicit sort options
    if (sort === "priceAsc")
      items = items.sort((a, b) => a.pricePerRequest - b.pricePerRequest);
    if (sort === "priceDesc")
      items = items.sort((a, b) => b.pricePerRequest - a.pricePerRequest);
    if (sort === "popularity")
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    if (sort === "newest")
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );

    return items;
  }, [search, selectedCategories, minPrice, maxPrice, popularity, sort]);

  const displayedItems = filtered.slice(0, shown);

  const handleViewDetails = (api: APIItem) => {
    history.pushState({}, "", `/details/${api.id}`);
    // inform our small client router that the URL changed
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="marketplace-page">
      {/* Top row: title + search only */}
      <div
        className="marketplace-header"
      >
        <h1>API Marketplace</h1>
        <div className="marketplace-search">
          <SearchBar value={search} onChange={setSearch} />
        </div>
      </div>

      {/* Bottom: filters left, content right */}
      <div
        className="marketplace-layout"
      >
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
          <div
            className="marketplace-toolbar"
          >
            <div className="marketplace-count">
              {filtered.length === 0 ? (
                <>Showing 0 of 0 APIs</>
              ) : (
                <>
                  Showing 1-{Math.min(shown, filtered.length)} of{" "}
                  {filtered.length} APIs
                </>
              )}
            </div>

            <div className="marketplace-actions">
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="priceAsc">Price: low → high</option>
                <option value="priceDesc">Price: high → low</option>
                <option value="popularity">Popularity</option>
                <option value="newest">Newest</option>
              </select>
              <button
                className="ghost-button marketplace-filter-button"
                onClick={() => setShowFiltersMobile((s) => !s)}
              >
                Filters
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              className="marketplace-grid"
            >
              {isLoading ? (
                Array.from({ length: shown }).map((_, i) => (
                  <ApiCardSkeleton key={i} />
                ))
              ) : (
                displayedItems.map((a) => (
                  <ApiCard key={a.id} api={a} onViewDetails={handleViewDetails} />
                ))
              )}
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

      {showFiltersMobile && (
        <div
          role="dialog"
          aria-modal="true"
          className="marketplace-filter-modal"
          onClick={() => setShowFiltersMobile(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="marketplace-filter-panel"
          >
            <h3>Filters</h3>
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
            <div className="marketplace-filter-footer">
              <button
                className="primary-button"
                onClick={() => setShowFiltersMobile(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
