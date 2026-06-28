import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ApiCard, { ApiCardSkeleton } from "../components/ApiCard";
import SearchBar from "../components/SearchBar";
import FiltersSidebar from "../components/FiltersSidebar";
import EmptyState from "../components/EmptyState";
import { Pagination } from "../components/Pagination";
import MOCK_APIS, { type APIItem } from "../data/mockApis";
import { useDebounce } from "../hooks/useDebounce";
import { useLocalStorage } from "../hooks/useLocalStorage";

export default function MarketplacePage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [popularity, setPopularity] = useState<string>("any");
  const [sort, setSort] = useState<string>("relevance");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Page size with localStorage persistence
  const [pageSize, setPageSize] = useLocalStorage<number>("callora.pageSize", 12);

  // Get current page from URL or default to 1
  const currentPage = useMemo(() => {
    const pageParam = searchParams.get("page");
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    return isNaN(page) ? 1 : page;
  }, [searchParams]);

  // Filter and sort items
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

    if (minPrice !== null)
      items = items.filter((a) => a.pricePerRequest >= minPrice);
    if (maxPrice !== null)
      items = items.filter((a) => a.pricePerRequest <= maxPrice);

    if (popularity === "mostUsed") {
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    } else if (popularity === "newest") {
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );
    }

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
  }, [debouncedSearch, selectedCategories, minPrice, maxPrice, popularity, sort]);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Clamp current page to valid range
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Slice items for current page
  const displayedItems = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, validCurrentPage, pageSize]);

  // Handlers
  const toggleCategory = (c: string) => {
    const copy = new Set(selectedCategories);
    if (copy.has(c)) copy.delete(c);
    else copy.add(c);
    setSelectedCategories(copy);
    setSearchParams({ page: "1" });
  };

  const clearFilters = () => {
    setSelectedCategories(new Set());
    setMinPrice(null);
    setMaxPrice(null);
    setPopularity("any");
    setSort("relevance");
    setSearchParams({ page: "1" });
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setSearchParams({ page: page.toString() });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setSearchParams({ page: "1" });
  };

  const handleViewDetails = (api: APIItem) => {
    history.pushState({}, "", `/details/${api.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // If page is invalid, update URL
  useEffect(() => {
    if (validCurrentPage !== currentPage) {
      setSearchParams({ page: validCurrentPage.toString() });
    }
  }, [validCurrentPage, currentPage, setSearchParams]);

  // Reset page when filters change
  useEffect(() => {
    if (!isLoading) {
      setSearchParams({ page: "1" });
    }
  }, [debouncedSearch, selectedCategories, minPrice, maxPrice, popularity, sort, setSearchParams, isLoading]);

  const startItem = (validCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(validCurrentPage * pageSize, filtered.length);

  return (
    <div className="marketplace-page">
      <div className="marketplace-header">
        <h1>API Marketplace</h1>
        <div className="marketplace-search">
          <SearchBar value={search} onChange={setSearch} />
        </div>
      </div>

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
                  Showing {startItem}-{endItem} of {filtered.length} APIs
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

          {/* Top pagination */}
          {filtered.length > 0 && (
            <Pagination
              currentPage={validCurrentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="marketplace-grid">
              {isLoading ? (
                Array.from({ length: Math.min(pageSize, 12) }).map((_, i) => (
                  <ApiCardSkeleton key={i} />
                ))
              ) : (
                displayedItems.map((a) => (
                  <ApiCard key={a.id} api={a} onViewDetails={handleViewDetails} />
                ))
              )}
            </div>
          )}

          {/* Bottom pagination */}
          {filtered.length > 0 && (
            <Pagination
              currentPage={validCurrentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
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
