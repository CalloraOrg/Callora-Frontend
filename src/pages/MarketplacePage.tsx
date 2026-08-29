import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ApiCard from "../components/ApiCard";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useFavorites } from "../hooks/useFavorites";
import SearchBar from "../components/SearchBar";
import SortDropdown, { type SortValue } from "../components/SortDropdown";

import CategoryPills from "../components/CategoryPills";
import ApiTagFilter, { getAllUniqueTags } from "./ApiTagFilter";
import FiltersSidebar, { ALL_CATEGORIES } from "../components/FiltersSidebar";
import KbdHint from "../components/KbdHint";
import { SHORTCUTS } from "../hooks/useGlobalShortcuts";
import EmptyState from "../components/EmptyState";
import { Pagination } from "../components/Pagination";
import MOCK_APIS, { type APIItem } from "../data/mockApis";
import { useDebounce } from "../hooks/useDebounce";
import { useFetchTracker } from "../hooks/useFetchTracker";
import { LOADING_DELAY_MS } from "../config/constants";
import {
  readDensityPreference,
  persistDensityPreference,
  type DensityPreference,
} from "../utils/density";

import FiltersBottomSheet from "../components/FiltersBottomSheet";
import LiveRegion from "../components/LiveRegion";
import RecentlyActiveRail from "../components/RecentlyActiveRail";
import { useCompareStore } from "../state/compareStore";
import MarketplacePageSkeleton from "./MarketplacePage.skeleton";
import { useCursorPagination } from "../hooks/useCursorPagination";

export default function MarketplacePage(): JSX.Element {
  const { apis } = useCompareStore();
  const isTrayVisible = apis.length > 0;
  const { trackFetch } = useFetchTracker();
  const [pageSize, setPageSize] = useState(12);

  useDocumentTitle(
    "Marketplace – Callora",
    "Explore APIs on the Callora marketplace, discover and integrate APIs for your applications.",
  );

  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearchRaw] = useState(
    () => searchParams.get("q") ?? "",
  );

  const setSearch = (v: string) => {
    setSearchRaw(v);
    setSearchParams((prev) => {
      if (v) prev.set("q", v); else prev.delete("q");
      return prev;
    }, { replace: true });
  };

  const [density, setDensity] = useState<DensityPreference>(() =>
    readDensityPreference(),
  );
  const debouncedSearch = useDebounce(search, 300);
  // ── Filter persistence in URL ──────────────────────────────────────────────
  const [selectedCategories, setSelectedCategoriesRaw] = useState<Set<string>>(
    () => {
      const raw = searchParams.get("categories");
      return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
    },
  );
  const setSelectedCategories = (next: Set<string>) => {
    setSelectedCategoriesRaw(next);
    setSearchParams(
      (prev) => {
        if (next.size > 0) prev.set("categories", [...next].join(","));
        else prev.delete("categories");
        return prev;
      },
      { replace: true },
    );
  };

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    () => {
      const raw = searchParams.get("statuses");
      return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
    },
  );

  const [selectedTag, setSelectedTagRaw] = useState<string | null>(() =>
    searchParams.get("tag"),
  );
  const setSelectedTag = (tag: string | null) => {
    setSelectedTagRaw(tag);
    setSearchParams(
      (prev) => {
        if (tag) prev.set("tag", tag);
        else prev.delete("tag");
        return prev;
      },
      { replace: true },
    );
  };

  const [minPrice, setMinPriceRaw] = useState<number | null>(() => {
    const v = searchParams.get("minPrice");
    return v ? Number(v) : null;
  });
  const setMinPrice = (v: number | null) => {
    setMinPriceRaw(v);
    setSearchParams(
      (prev) => {
        if (v !== null) prev.set("minPrice", String(v));
        else prev.delete("minPrice");
        return prev;
      },
      { replace: true },
    );
  };

  const [maxPrice, setMaxPriceRaw] = useState<number | null>(() => {
    const v = searchParams.get("maxPrice");
    return v ? Number(v) : null;
  });
  const setMaxPrice = (v: number | null) => {
    setMaxPriceRaw(v);
    setSearchParams(
      (prev) => {
        if (v !== null) prev.set("maxPrice", String(v));
        else prev.delete("maxPrice");
        return prev;
      },
      { replace: true },
    );
  };

  const [popularity, setPopularityRaw] = useState<string>(
    () => searchParams.get("popularity") ?? "any",
  );
  const setPopularity = (v: string) => {
    setPopularityRaw(v);
    setSearchParams(
      (prev) => {
        if (v !== "any") prev.set("popularity", v);
        else prev.delete("popularity");
        return prev;
      },
      { replace: true },
    );
  };
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const [favoritesOnly, setFavoritesOnlyRaw] = useState(
    () => searchParams.get("favorites") === "1",
  );
  const setFavoritesOnly = (v: boolean) => {
    setFavoritesOnlyRaw(v);
    setSearchParams((prev) => {
      if (v) prev.set("favorites", "1"); else prev.delete("favorites");
      return prev;
    }, { replace: true });
  };

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

  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const filtersTriggerRef = useRef<HTMLButtonElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const abortController = new AbortController();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    trackFetch(
      new Promise<void>((resolve) => {
        if (prefersReducedMotion) {
          setIsLoading(false);
          resolve();
        } else {
          const timer = setTimeout(() => {
            if (!abortController.signal.aborted) {
              setIsLoading(false);
              resolve();
            }
          }, LOADING_DELAY_MS);
          abortController.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        }
      }),
    );
    return () => abortController.abort();
  }, [trackFetch]);

  useEffect(() => {
    persistDensityPreference(density);
  }, [density]);

  const hasActiveFilters = () => {
    return (
      search.trim() !== "" ||
      selectedCategories.size > 0 ||
      selectedTag !== null ||
      minPrice !== null ||
      maxPrice !== null ||
      popularity !== "any" ||
      favoritesOnly ||
      selectedStatuses.size > 0
    );
  };

  const activeFilterCount =
    selectedCategories.size +
    (minPrice !== null ? 1 : 0) +
    (maxPrice !== null ? 1 : 0) +
    (popularity !== "any" ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (selectedStatuses.size > 0 ? 1 : 0);

  const handleRetryFetch = async () => {
    setFetchError(null);
    setIsLoading(true);
    await trackFetch(new Promise((resolve) => setTimeout(resolve, 500)));
    setIsLoading(false);
  };

  const allTags = useMemo(() => getAllUniqueTags(), []);

  // ── Aria-live announcements for screen readers ───────────────────────
  const [announcement, setAnnouncement] = useState("");
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((msg: string) => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    setAnnouncement(msg);
    announceTimerRef.current = setTimeout(() => setAnnouncement(""), 3000);
  }, []);

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

    if (selectedStatuses.size > 0) {
      items = items.filter((a) => a.status && selectedStatuses.has(a.status));
    }

    if (favoritesOnly) {
      items = items.filter((a) => favorites.includes(a.id));
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

    if (popularity === "mostUsed") {
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    } else if (popularity === "newest") {
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );
    }

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
    favoritesOnly,
    sortParam,
    selectedStatuses,
  ]);

  // ── Cursor pagination ──────────────────────────────────────────────────
  const initialCursor = searchParams.get("cursor");
  const {
    pageItems,
    hasNextPage,
    hasPreviousPage,
    currentPageIndex,
    totalItemCount,
    goToNextPage,
    goToPreviousPage,
    resetCursor,
    currentCursor,
  } = useCursorPagination(filtered, pageSize, initialCursor);

  // Sync cursor to URL
  useEffect(() => {
    setSearchParams(
      (prev) => {
        if (currentCursor) {
          prev.set("cursor", currentCursor);
        } else {
          prev.delete("cursor");
        }
        return prev;
      },
      { replace: true },
    );
  }, [currentCursor, setSearchParams]);

  // Reset cursor when filters change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    resetCursor();
  }, [
    debouncedSearch,
    selectedCategories,
    selectedTag,
    minPrice,
    maxPrice,
    popularity,
    sortParam,
    selectedStatuses,
    favoritesOnly,
    resetCursor,
  ]);

  // ── Aria-live announcements (relies on filtered being defined above) ──
  const prevIsLoading = useRef(isLoading);
  const prevFetchError = useRef(fetchError);
  const prevPageIndex = useRef(currentPageIndex);

  useEffect(() => {
    if (prevIsLoading.current && !isLoading) {
      if (fetchError) {
        announce(`Error loading marketplace: ${fetchError}`);
      } else {
        announce("Marketplace loaded.");
      }
    } else if (!prevIsLoading.current && isLoading) {
      announce("Loading marketplace...");
    }
    prevIsLoading.current = isLoading;
  }, [isLoading, fetchError, announce]);

  useEffect(() => {
    if (fetchError && fetchError !== prevFetchError.current && !isLoading) {
      announce(`Error loading marketplace: ${fetchError}`);
    }
    prevFetchError.current = fetchError;
  }, [fetchError, isLoading, announce]);

  useEffect(() => {
    if (prevPageIndex.current !== currentPageIndex) {
      const newStart = totalItemCount > 0 ? currentPageIndex * pageSize + 1 : 0;
      const newEnd = Math.min((currentPageIndex + 1) * pageSize, totalItemCount);
      announce(`Page changed. Showing APIs ${newStart} through ${newEnd}.`);
      prevPageIndex.current = currentPageIndex;
    }
  }, [currentPageIndex, pageSize, totalItemCount, announce]);

  const prevFilteredCount = useRef(0);
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    const prev = prevFilteredCount.current;
    if (prev !== filtered.length) {
      if (filtered.length === 0 && prev > 0) {
        announce("No APIs match the current filters.");
      } else if (filtered.length > 0 && prev === 0) {
        announce(`${filtered.length} API${filtered.length !== 1 ? "s" : ""} found.`);
      }
      prevFilteredCount.current = filtered.length;
    }
  }, [filtered.length, announce]);

  const prevTag = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevTag.current;
    if (selectedTag !== prev) {
      if (selectedTag) {
        announce(`Filtering by tag: ${selectedTag}`);
      } else {
        announce("Tag filter removed.");
      }
      prevTag.current = selectedTag;
    }
  }, [selectedTag, announce]);

  const handleTagClick = (tag: string) => {
    setSelectedTag(
      selectedTag?.toLowerCase() === tag.toLowerCase() ? null : tag,
    );
  };

  // Handlers
  const toggleCategory = (c: string) => {
    const copy = new Set(selectedCategories);
    if (copy.has(c)) copy.delete(c);
    else copy.add(c);
    setSelectedCategories(copy);
  };

  const toggleStatus = (s: string) => {
    const copy = new Set(selectedStatuses);
    if (copy.has(s)) copy.delete(s);
    else copy.add(s);
    setSelectedStatuses(copy);
  };

  const clearCategories = () => {
    setSelectedCategories(new Set());
  };

  const clearFilters = () => {
    setSelectedCategories(new Set());
    setSelectedTag(null);
    setMinPrice(null);
    setMaxPrice(null);
    setPopularity("any");
    setFavoritesOnly(false);
    setSelectedStatuses(new Set());
    setSortParam("popularity");
    setSearch("");
    announce("All filters cleared. Showing all APIs.");
    setPageSize(12);
  };

  const handlePageChange = () => {
    setIsPageLoading(true);
    requestAnimationFrame(() => {
      setIsPageLoading(false);
    });
  };

  const handleGoNext = () => {
    handlePageChange();
    goToNextPage();
  };

  const handleGoPrevious = () => {
    handlePageChange();
    goToPreviousPage();
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    resetCursor();
  };

  const handleViewDetails = (api: APIItem) => {
    history.pushState({}, "", `/details/${api.id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const startItem = totalItemCount > 0 ? currentPageIndex * pageSize + 1 : 0;
  const endItem = Math.min(
    (currentPageIndex + 1) * pageSize,
    totalItemCount,
  );

  if (isLoading) {
    return (
      <>
        <MarketplacePageSkeleton density={density} />
        <LiveRegion message={announcement} />
      </>
    );
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
          <div
            className="marketplace-density-toggle"
            role="group"
            aria-label="Results density"
          >
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

      {/* Rail of APIs with the most recent usage */}
      <RecentlyActiveRail apis={MOCK_APIS} onSelect={handleViewDetails} />

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
            favoritesOnly={favoritesOnly}
            toggleFavoritesOnly={() => setFavoritesOnly(!favoritesOnly)}
            selectedStatuses={selectedStatuses}
            toggleStatus={toggleStatus}
            resultCount={filtered.length}
          />
        </aside>

        <main
          className={
            isTrayVisible
              ? "marketplace-results marketplace-results--tray-open"
              : "marketplace-results"
          }
        >
          <div className="marketplace-toolbar">
            <div className="marketplace-count">
              {filtered.length === 0 ? (
                <>
                  Showing{" "}
                  <span className="numeric-tabular">0</span>
                  {" "}of{" "}
                  <span className="numeric-tabular">0</span>
                  {" "}APIs
                </>
              ) : (
                <>
                  Showing{" "}
                  <span className="numeric-tabular">{startItem}</span>
                  {"–"}
                  <span className="numeric-tabular">{endItem}</span>
                  {" "}of{" "}
                  <span className="numeric-tabular">{filtered.length}</span>
                  {" "}APIs
                </>
              )}
              {selectedTag && (
                <span className="marketplace-active-tag" aria-live="polite">
                  Filtered by tag: #{selectedTag}
                </span>
              )}
            </div>

            <div className="marketplace-actions">
              <select
                value={sortParam}
                onChange={(e) => setSortParam(e.target.value as SortValue)}
              >
                <option value="relevance">Relevance</option>
                <option value="priceAsc">Price: low → high</option>
                <option value="priceDesc">Price: high → low</option>
                <option value="popularity">Popularity</option>
                <option value="newest">Newest</option>
              </select>

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
                    className="marketplace-filter-badge numeric-tabular"
                    aria-label={`${activeFilterCount} active filter${activeFilterCount !== 1 ? "s" : ""}`}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <CategoryPills
            categories={ALL_CATEGORIES}
            selectedCategories={selectedCategories}
            toggleCategory={toggleCategory}
            clearCategories={clearCategories}
          />

          <ApiTagFilter
            tags={allTags}
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
          />

          {fetchError ? (
            <EmptyState variant="error" onRetry={handleRetryFetch} />
          ) : filtered.length === 0 ? (
            <EmptyState
              variant={hasActiveFilters() ? "filtered" : "empty"}
              title={
                favoritesOnly
                  ? "No favorites yet"
                  : hasActiveFilters()
                    ? "No results found"
                    : "No APIs available"
              }
              message={
                favoritesOnly
                  ? "Try starring some APIs to see them here!"
                  : hasActiveFilters()
                    ? "Try adjusting your filters or clear them to see all available APIs."
                    : "The marketplace is empty right now. Check back soon for new integrations!"
              }
              onClearFilters={hasActiveFilters() ? clearFilters : undefined}
              action={
                !hasActiveFilters() && !favoritesOnly
                  ? {
                      label: "Clear all filters",
                      onClick: clearFilters,
                    }
                  : undefined
              }
              secondaryAction={
                favoritesOnly
                  ? {
                      label: "Browse all APIs",
                      onClick: () => setFavoritesOnly(false),
                    }
                  : hasActiveFilters()
                    ? {
                        label: "Browse all APIs",
                        onClick: clearFilters,
                      }
                    : undefined
              }
            />
          ) : (
            <div className="marketplace-grid">
              {pageItems.map((a) => (
                <ApiCard
                  key={a.id}
                  api={a}
                  density={density}
                  onViewDetails={handleViewDetails}
                  onTagClick={handleTagClick}
                  activeTag={selectedTag}
                />
              ))}
            </div>
          )}

          {/* Cursor-based pagination */}
          {filtered.length > 0 && (
            <Pagination
              mode="cursor"
              currentPageIndex={currentPageIndex}
              hasNextPage={hasNextPage}
              hasPreviousPage={hasPreviousPage}
              totalItemCount={totalItemCount}
              pageSize={pageSize}
              onGoNext={handleGoNext}
              onGoPrevious={handleGoPrevious}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </main>
      </div>

      {/* Screen-reader announcement region */}
      <LiveRegion message={announcement} />

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
        favoritesOnly={favoritesOnly}
        toggleFavoritesOnly={() => setFavoritesOnly(!favoritesOnly)}
        selectedStatuses={selectedStatuses}
        toggleStatus={toggleStatus}
        triggerRef={filtersTriggerRef}
      />

      {/* Keyboard shortcuts hint */}
      <KbdHint
        shortcuts={SHORTCUTS.filter((s) => s.category === "Marketplace")}
      />
    </div>
  );
}
