import { useEffect, useMemo, useRef, useState } from "react";
import ApiCard, { ApiCardSkeleton } from "../components/ApiCard";
import useDocumentTitle from "../hooks/useDocumentTitle";
import SearchBar from "../components/SearchBar";
import FiltersSidebar from "../components/FiltersSidebar";
import EmptyState from "../components/EmptyState";
import { useDebounce } from "../hooks/useDebounce";
import { fetchCatalog, type CatalogParams, type CatalogResponse } from "../api/catalogApi";
import type { APIItem } from "../data/mockApis";
import MOCK_APIS from "../data/mockApis";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const isBackendMode = Boolean(API_BASE);

function getCategoryFromSelection(selectedCategories: Set<string>): string | undefined {
  return selectedCategories.size === 1 ? selectedCategories.values().next().value : undefined;
}

function filterItemsClientSide(
  items: APIItem[],
  debouncedSearch: string,
  selectedCategories: Set<string>,
  minPrice: number | null,
  maxPrice: number | null,
  popularity: string,
  sort: string
): APIItem[] {
  let filtered = items.slice();

  if (debouncedSearch.trim()) {
    const q = debouncedSearch.toLowerCase();
    filtered = filtered.filter((a) => {
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.provider?.name?.toLowerCase().includes(q) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }

  if (selectedCategories.size > 0) {
    filtered = filtered.filter((a) => selectedCategories.has(a.category ?? ""));
  }

  const hasInvertedPrice = minPrice !== null && maxPrice !== null && minPrice > maxPrice;
  if (!hasInvertedPrice) {
    if (minPrice !== null) filtered = filtered.filter((a) => a.pricePerRequest >= minPrice);
    if (maxPrice !== null) filtered = filtered.filter((a) => a.pricePerRequest <= maxPrice);
  }

  if (popularity === "mostUsed") {
    filtered = filtered.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
  } else if (popularity === "newest") {
    filtered = filtered.sort(
      (a, b) =>
        Date.parse(b.createdAt ?? "1970-01-01") - Date.parse(a.createdAt ?? "1970-01-01"),
    );
  }

  if (sort === "priceAsc") filtered = filtered.sort((a, b) => a.pricePerRequest - b.pricePerRequest);
  if (sort === "priceDesc") filtered = filtered.sort((a, b) => b.pricePerRequest - a.pricePerRequest);
  if (sort === "popularity") filtered = filtered.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
  if (sort === "newest")
    filtered = filtered.sort(
      (a, b) => Date.parse(b.createdAt ?? "1970-01-01") - Date.parse(a.createdAt ?? "1970-01-01"),
    );

  return filtered;
}

export default function MarketplacePage(): JSX.Element {
  useDocumentTitle("Marketplace – Callora", "Explore APIs on the Callora marketplace, discover and integrate APIs for your applications.");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [popularity, setPopularity] = useState<string>("any");
  const [sort, setSort] = useState<string>("relevance");
  const [shown, setShown] = useState<number>(12);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<APIItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

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
    setSearch("");
  };

  const hasActiveFilters = () => {
    return (
      search.trim() !== "" ||
      selectedCategories.size > 0 ||
      minPrice !== null ||
      maxPrice !== null ||
      popularity !== "any"
    );
  };

  const handleRetryFetch = async () => {
    setFetchError(null);
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsLoading(false);
  };

  const fetchParams = useMemo<CatalogParams>(() => {
    const params: CatalogParams = {};
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }
    const category = getCategoryFromSelection(selectedCategories);
    if (category) {
      params.category = category;
    }
    return params;
  }, [debouncedSearch, selectedCategories]);

  useEffect(() => {
    if (!isBackendMode) {
      setCatalogItems(MOCK_APIS);
      setIsLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setFetchError(null);

    fetchCatalog(controller.signal, fetchParams)
      .then((response: CatalogResponse) => {
        if (seq !== requestSeqRef.current) return;
        setCatalogItems(response.items);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (seq !== requestSeqRef.current) return;
        if (err.name === "AbortError") return;
        setFetchError(err.message);
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [fetchParams, isBackendMode]);

  const filtered = useMemo(() => {
    return filterItemsClientSide(
      catalogItems,
      debouncedSearch,
      selectedCategories,
      minPrice,
      maxPrice,
      popularity,
      sort
    );
  }, [catalogItems, debouncedSearch, selectedCategories, minPrice, maxPrice, popularity, sort]);

  const displayedItems = filtered.slice(0, shown);

  const handleViewDetails = (api: APIItem) => {
    history.pushState({}, "", `/details/${api.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

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

          {fetchError ? (
            <EmptyState variant="error" onRetry={handleRetryFetch} />
          ) : filtered.length === 0 ? (
            <EmptyState
              variant={hasActiveFilters() ? "filtered" : "empty"}
              onClearFilters={hasActiveFilters() ? clearFilters : undefined}
            />
          ) : (
            <div className="marketplace-grid">
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
              <button className="primary-button" onClick={() => setShown((s) => s + 12)}>
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
          <div onClick={(e) => e.stopPropagation()} className="marketplace-filter-panel">
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
              <button className="primary-button" onClick={() => setShowFiltersMobile(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}