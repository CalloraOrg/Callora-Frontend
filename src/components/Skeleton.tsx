import { CSSProperties, Fragment } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
  className?: string;
  tone?: "neutral" | "stellar";
}

export default function Skeleton({
  width,
  height,
  borderRadius,
  style,
  className = "",
  tone = "neutral",
}: SkeletonProps) {
  return (
    <div
      className={`skeleton${tone === "stellar" ? " skeleton--stellar" : ""} ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

// Row variant for table loading
export function SkeletonRow({ rows = 5 }: { rows?: number }) {
  const rowSkeleton = (
    <div className="table-row">
      <Skeleton width="60%" height="16px" className="skeleton-cell" />
      <Skeleton width="85%" height="16px" className="skeleton-cell" />
      <Skeleton width="50%" height="16px" className="skeleton-cell" />
      <Skeleton width="45%" height="16px" className="skeleton-cell" />
      <Skeleton width="35%" height="16px" className="skeleton-cell" />
      <Skeleton width="50%" height="16px" className="skeleton-cell" />
    </div>
  );
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <Fragment key={i}>{rowSkeleton}</Fragment>
      ))}
    </>
  );
}

export function FiltersSidebarSkeleton() {
  return (
    <div className="filters-sidebar filters-sidebar-skeleton" aria-hidden="true" style={{ display: "grid", gap: 16 }}>
      {/* Section heading */}
      <Skeleton width="55%" height={22} />
      <Skeleton width="55%" height={22} />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} style={{ display: "grid", gap: 8 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={40} borderRadius={10} />
        </div>
      ))}
      <Skeleton width="48%" height={14} />
      <Skeleton width="100%" height={44} borderRadius={12} />
    </div>
  );
}

export function MarketplacePageSkeleton() {
  return (
    <div className="marketplace-page marketplace-skeleton" aria-busy="true" aria-label="Loading marketplace">
      <div className="marketplace-header">
        <Skeleton width="220px" height={36} borderRadius={8} />
        <div className="marketplace-search-row">
          <div className="marketplace-search">
            <Skeleton width="100%" height={44} borderRadius={12} />
          </div>
          <div className="marketplace-density-toggle" aria-hidden="true" style={{ display: "flex", gap: 8 }}>
            <Skeleton width={90} height={44} borderRadius={999} />
            <Skeleton width={90} height={44} borderRadius={999} />
          </div>
        </div>
        <Skeleton width={160} height={44} borderRadius={8} />
      </div>

      <div className="marketplace-layout">
        <aside className="marketplace-sidebar" aria-hidden="true">
          <Skeleton width="100%" height={20} />
          <Skeleton width="80%" height={48} borderRadius={10} />
          <Skeleton width="60%" height={14} />
          <Skeleton width="100%" height={48} borderRadius={10} />
          <Skeleton width="70%" height={14} />
          <Skeleton width="100%" height={48} borderRadius={10} />
          <Skeleton width="50%" height={14} />
          <Skeleton width="100%" height={48} borderRadius={10} />
          <Skeleton width="100%" height={44} borderRadius={12} />
        </aside>

        <main className="marketplace-results">
          <div className="marketplace-toolbar">
            <div className="marketplace-count">
              <Skeleton width={120} height={18} />
            </div>
            <div className="marketplace-actions">
              <Skeleton width={140} height={44} borderRadius={8} />
              <Skeleton width={80} height={44} borderRadius={8} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} width={70 + i * 15} height={32} borderRadius={999} />
            ))}
          </div>

          <div
            className="marketplace-grid"
            aria-label="Loading APIs"
            style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {Array.from({ length: 12 }).map((_, index) => (
              <article key={index} className="api-marketplace-card api-card-skeleton" aria-hidden="true" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, minHeight: 220, border: "1px solid rgba(255,255,255,0.03)" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Skeleton tone="stellar" width={56} height={56} borderRadius={10} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <Skeleton tone="stellar" width="60%" height={18} />
                      <Skeleton tone="stellar" width="20%" height={12} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Skeleton tone="stellar" width="90%" height={14} />
                      <Skeleton tone="stellar" width="70%" height={14} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <Skeleton tone="stellar" width={50} height={12} />
                    <Skeleton tone="stellar" width={40} height={16} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  <Skeleton tone="stellar" width={45} height={24} borderRadius={8} />
                  <Skeleton tone="stellar" width={55} height={24} borderRadius={8} />
                  <Skeleton tone="stellar" width={40} height={24} borderRadius={8} />
                </div>
                <div style={{ display: "flex", gap: 8, paddingTop: 8, marginTop: "auto" }}>
                  <Skeleton width="33%" height={14} />
                  <Skeleton width="33%" height={14} />
                  <Skeleton width="33%" height={14} />
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>

      <span className="sr-only">Loading marketplace content</span>
    </div>
  );
}

