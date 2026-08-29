import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ApiCard from "../components/ApiCard";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useFavorites } from "../hooks/useFavorites";
import { useMarketplaceUrlState } from "../hooks/useMarketplaceUrlState";
import { useAccountContext } from "../hooks/useAccountContext";
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

  // Single source of truth for every marketplace filter: the URL. The hook
  // derives each value from `searchParams` on render and only ever writes back
  // to the URL, so back/forward, refreshes, and deep links can never leave the
  // UI showing a stale, locally-cached filter (#989).
  const {
    query,
    queryDraft,
    commitQuery,
    setQueryDraft,
    categories,
    setCategories,
    statuses,
    setStatuses,
    tag,
    setTag,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    popularity,
    setPopularity,
    favoritesOnly,
    setFavoritesOnly,
    sort,
    setSort,
    clearAll,
  } = useMarketplaceUrlState();

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const [density, setDensity] = useState<DensityPreference>(() =>
    readDensityPreference(),
  );
  const debouncedQuery = useDebounce(query, 300);

  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const filtersTriggerRef = useRef<HTMLButtonElement>(null);
  const isInitialMount = useRef(true);
  // Monotonic sequence that guards the loading transition: only the latest
  // in-flight load may flip `isLoading` off, so a stale timer from an earlier
  // navigation can never overwrite the loading state of a newer one (#989).
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const seq = ++requestSeqRef.current;
    const abortController = new AbortController();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    trackFetch(
      new Promise<void>((resolve) => {
        if (prefersReducedMotion) {
          if (seq === requestSeqRef.current) setIsLoading(false);
          resolve();
        } else {
          const timer = setTimeout(() => {
            if (!abortController.signal.aborted) {
              if (seq === requestSeqRef.current) setIsLoading(false);
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
      query.trim() !== "" ||
      categories.size > 0 ||
      tag !== null ||
      minPrice !== null ||
      maxPrice !== null ||
      popularity !== "any" ||
      favoritesOnly ||
      statuses.size > 0
    );
  };

  const activeFilterCount =
    categories.size +
    (minPrice !== null ? 1 : 0) +
    (maxPrice !== null ? 1 : 0) +
    (popularity !== "any" ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (statuses.size > 0 ? 1 : 0);

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

  // Account-switch reset. Marketplace filters are scoped to the active account
  // (favorites, category availability, etc.), so when the account changes we
  // clear every filter + cursor from the URL. This guarantees the new account
  // starts from authoritative, non-stale state instead of inheriting a previous
  // account's selections (stale-state guard for #989).
  const { account } = useAccountContext();
  const accountIdRef = useRef(account?.id);
  useEffect(() => {
    if (accountIdRef.current === account?.id) return;
    accountIdRef.current = account?.id;
    clearAll();
    announce("Switched account. Marketplace filters were reset.");
  }, [account?.id, clearAll, announce]);

  // Filter and sort items
  const filtered = useMemo(() => {
    let items = MOCK_APIS.slice();

    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      items = items.filter((a) => {
        return (
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.provider?.name?.toLowerCase().includes(q) ||
          (a.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    if (categories.size > 0) {
      items = items.filter((a) => categories.has(a.category ?? ""));
    }

    if (statuses.size > 0) {
      items = items.filter((a) => a.status && statuses.has(a.status));
    }

    if (favoritesOnly) {
      items = items.filter((a) => favorites.includes(a.id));
    }

    if (tag) {
      const normalizedTag = tag.toLowerCase();
      items = items.filter((a) =>
        (a.tags || []).some((t) => t.toLowerCase() === normalizedTag),
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

    if (sort === "price-asc")
      items = items.sort((a, b) => a.pricePerRequest - b.pricePerRequest);
    if (sort === "latency-asc")
      items = items.sort(
        (a, b) =>
          (a.stats?.avgResponseMs ?? Number.MAX_SAFE_INTEGER) -
          (b.stats?.avgResponseMs ?? Number.MAX_SAFE_INTEGER),
      );
    if (sort === "popularity")
      items = items.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    if (sort === "newest")
      items = items.sort(
        (a, b) =>
          Date.parse(b.createdAt ?? "1970-01-01") -
          Date.parse(a.createdAt ?? "1970-01-01"),
      );

    return items;
  }, [
    debouncedQuery,
    categories,
    tag,
    minPrice,
    maxPrice,
    popularity,
    favoritesOnly,
    sort,
    statuses,
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
    debouncedQuery,
    categories,
    tag,
    minPrice,
    maxPrice,
    popularity,
    sort,
    statuses,
    favoritesOnly,
    resetCursor,
  ]);

  // ── Aria-live announcements (relies on filtered being defined above) ──
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
    if (tag !== prev) {
      if (tag) {
        announce(`Filtering by tag: ${tag}`);
      } else {
        announce("Tag filter removed.");
      }
      prevTag.current = tag;
    }
  }, [tag, announce]);

  const handleTagClick = (clickedTag: string) => {
    setTag(tag?.toLowerCase() === clickedTag.toLowerCase() ? null : clickedTag);
  };

  // Handlers
  const toggleCategory = (c: string) => {
    const copy = new Set(categories);
    if (copy.has(c)) copy.delete(c);
    else copy.add(c);
    setCategories(copy);
  };

  const toggleStatus = (s: string) => {
    const copy = new Set(statuses);
    if (copy.has(s)) copy.delete(s);
    else copy.add(s);
    setStatuses(copy);
  };

  const clearCategories = () => {
    setCategories(new Set());
  };

  const clearFilters = () => {
    clearAll();
    announce("All filters cleared. Showing all APIs.");
    setPageSize(12);
  };

  const handlePageChange = () => {
    const seq = ++requestSeqRef.current;
    setIsPageLoading(true);
    requestAnimationFrame(() => {
      if (seq === requestSeqRef.current) setIsPageLoading(false);
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
    return <MarketplacePageSkeleton density={density} />;
  }

  return (
    <div className="marketplace-page">
      {/* Top row: title + search only */}
      <div className="marketplace-header">
        <h1>API Marketplace</h1>
        <div className="marketplace-search-row">
          <div className="marketplace-search">
            <SearchBar value={queryDraft} onChange={commitQuery} />
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
        <SortDropdown value={sort} onChange={setSort} />
      </div>

      {/* Rail of APIs with the most recent usage */}
      <RecentlyActiveRail apis={MOCK_APIS} onSelect={handleViewDetails} />

      {/* Bottom: filters left, content right */}
      <div className="marketplace-layout">
        <aside className="marketplace-sidebar">
          <FiltersSidebar
            selectedCategories={categories}
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
            selectedStatuses={statuses}
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
              {tag && (
                <span className="marketplace-active-tag" aria-live="polite">
                  Filtered by tag: #{tag}
                </span>
              )}
            </div>

            <div className="marketplace-actions">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
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
            selectedCategories={categories}
            toggleCategory={toggleCategory}
            clearCategories={clearCategories}
          />

          <ApiTagFilter
            tags={allTags}
            selectedTag={tag}
            onTagChange={setTag}
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
                  activeTag={tag}
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
        selectedCategories={categories}
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
        selectedStatuses={statuses}
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
