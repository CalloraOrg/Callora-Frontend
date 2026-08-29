/**
 * MarketplacePage.skeleton.tsx
 *
 * Loading shell for the Marketplace page.
 * Mirrors the exact layout, spacing, components, and responsive grid structure of
 * MarketplacePage to ensure minimal cumulative layout shift (CLS) on data hydration.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Container carries aria-busy="true" and aria-label="Marketplace loading shell".
 * - Inner placeholders carry aria-hidden="true" to avoid screen-reader noise.
 */
import Skeleton, { FiltersSidebarSkeleton } from "../components/Skeleton";
import { ApiCardSkeleton } from "../components/ApiCard";
import { ApiTagFilterSkeleton } from "./ApiTagFilter";
import type { DensityPreference } from "../utils/density";

export default function MarketplacePageSkeleton({
  density = "comfortable",
}: {
  density?: DensityPreference;
}) {
  return (
    <div
      className="marketplace-page"
      aria-busy="true"
      aria-label="Marketplace loading shell"
    >
      {/* ── Header row ── */}
      <div className="marketplace-header">
        <h1>API Marketplace</h1>
        <div className="marketplace-search-row">
          <div className="marketplace-search">
            <Skeleton width="100%" height={44} borderRadius={10} />
          </div>
          <div
            className="marketplace-density-toggle"
            role="group"
            aria-label="Results density"
            aria-hidden="true"
          >
            <Skeleton width={110} height={38} borderRadius={8} />
            <Skeleton width={88} height={38} borderRadius={8} />
          </div>
        </div>
        <Skeleton width={170} height={40} borderRadius={10} />
      </div>

      {/* ── Recently Active Rail Placeholder ── */}
      <div
        className="recently-active-rail-skeleton"
        aria-hidden="true"
        style={{
          display: "flex",
          gap: 12,
          overflowX: "hidden",
          padding: "12px 0",
          marginBottom: 16,
        }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            width={200}
            height={72}
            borderRadius={12}
            style={{ flexShrink: 0 }}
          />
        ))}
      </div>

      {/* ── Main layout ── */}
      <div className="marketplace-layout">
        <aside className="marketplace-sidebar">
          <FiltersSidebarSkeleton />
        </aside>

        <main className="marketplace-results">
          {/* Toolbar: result count + actions */}
          <div className="marketplace-toolbar">
            <div className="marketplace-count">
              <Skeleton width={180} height={20} />
            </div>
            <div className="marketplace-actions" aria-hidden="true">
              <Skeleton width={140} height={38} borderRadius={8} />
              <Skeleton width={90} height={38} borderRadius={8} />
            </div>
          </div>

          {/* Category Pills placeholder */}
          <div
            className="pill-bar"
            aria-hidden="true"
            style={{ display: "flex", gap: 8, margin: "12px 0" }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                width={70 + (i % 3) * 20}
                height={34}
                borderRadius={999}
              />
            ))}
          </div>

          {/* Tag filter placeholder */}
          <div style={{ marginBottom: 16 }}>
            <ApiTagFilterSkeleton />
          </div>

          {/* Grid skeleton */}
          <div className="marketplace-grid">
            {Array.from({ length: 12 }).map((_, index) => (
              <ApiCardSkeleton key={index} density={density} />
            ))}
          </div>

          {/* Bottom pagination placeholder */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
              paddingTop: 16,
            }}
          >
            <Skeleton width={120} height={36} borderRadius={8} />
            <Skeleton width={200} height={36} borderRadius={8} />
          </div>
        </main>
      </div>
    </div>
  );
}
