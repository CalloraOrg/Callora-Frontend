/**
 * MarketplacePage.skeleton.tsx
 *
 * Loading shell for the Marketplace page.
 * Uses ApiCardSkeleton (from ApiCard.tsx) to keep skeleton shapes in
 * exact parity with the real cards — dimensions, layout structure, and
 * spacing all mirror the final rendered output so the CLS shift on load
 * is minimal.
 */
import Skeleton from "../components/Skeleton";
import { ApiCardSkeleton } from "../components/ApiCard";
import { FiltersSidebarSkeleton } from "../components/Skeleton";

export default function MarketplacePageSkeleton() {
  return (
    <div
      className="marketplace-page"
      aria-busy="true"
      aria-label="Marketplace loading shell"
    >
      {/* ── Header row ── */}
      <div className="marketplace-header">
        {/* Page title */}
        <Skeleton width={240} height={42} />

        {/* Search + density toggle */}
        <div className="marketplace-search-row">
          <Skeleton width="100%" height={48} borderRadius={12} />

          <div
            className="marketplace-density-toggle"
            aria-hidden="true"
            style={{ display: "flex", gap: 8 }}
          >
            <Skeleton width={118} height={40} borderRadius={999} />
            <Skeleton width={88} height={40} borderRadius={999} />
          </div>
        </div>

        {/* Sort dropdown */}
        <Skeleton width={170} height={40} borderRadius={12} />
      </div>

      {/* ── Main layout ── */}
      <div className="marketplace-layout">
        <aside className="marketplace-sidebar filters-sidebar">
          <FiltersSidebarSkeleton />
        </aside>

        <main className="marketplace-results">
          {/* Toolbar: result count + actions */}
          <div className="marketplace-toolbar">
            <Skeleton width="42%" height={18} />
            <div className="marketplace-actions" aria-hidden="true">
              {/* Sort dropdown placeholder */}
              <Skeleton width={142} height={40} borderRadius={10} />
              {/* Filters button placeholder */}
              <Skeleton width={110} height={40} borderRadius={10} />
            </div>
          </div>

          {/*
           * Card grid — ApiCardSkeleton is kept in sync with the real ApiCard
           * layout automatically, so any future card changes are reflected here.
           */}
          <div className="marketplace-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <ApiCardSkeleton key={index} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
