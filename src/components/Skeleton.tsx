import { CSSProperties, Fragment } from "react";
import Breadcrumb from "./Breadcrumb";

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

export function ApiUsageSkeleton() {
  return (
    <div
      className="api-usage-page"
      aria-busy="true"
      aria-label="API usage loading shell"
    >
      {/* Breadcrumb Skeleton */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }} aria-hidden="true">
        <Skeleton tone="stellar" width={80} height={16} />
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Skeleton tone="stellar" width={160} height={16} />
      </div>

      {/* Header Section Skeleton */}
      <div className="api-header" aria-hidden="true" style={{ marginBottom: 24 }}>
        <div className="api-header-info" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="api-logo">
            <Skeleton tone="stellar" width={56} height={56} borderRadius={12} />
          </div>
          <div style={{ display: "grid", gap: 8, flex: 1 }}>
            <Skeleton tone="stellar" width="40%" height={28} />
            <Skeleton tone="stellar" width="60%" height={16} />
          </div>
        </div>
        <div className="api-header-actions" style={{ display: "flex", gap: 12 }}>
          <Skeleton tone="stellar" width={150} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={90} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={110} height={36} borderRadius={8} />
        </div>
      </div>

      {/* API Key Section Skeleton */}
      <div className="surface api-key-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <Skeleton tone="stellar" width={100} height={20} style={{ marginBottom: 16 }} />
        <div className="api-key-card" style={{ padding: 20 }}>
          <div className="api-key-display" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="key-input-group" style={{ flex: 1 }}>
              <Skeleton tone="stellar" width="100%" height={38} borderRadius={8} />
            </div>
            <div className="key-actions" style={{ display: "flex", gap: 12 }}>
              <Skeleton tone="stellar" width={80} height={38} borderRadius={8} />
              <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
            </div>
          </div>
          <Skeleton tone="stellar" width="50%" height={14} style={{ marginTop: 12 }} />
        </div>
      </div>

      {/* Test API Call Section Skeleton */}
      <div className="surface test-call-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <Skeleton tone="stellar" width={140} height={20} style={{ marginBottom: 20 }} />
        <div className="test-call-form" style={{ display: "grid", gap: 16 }}>
          <div className="form-row" style={{ display: "grid", gap: 8 }}>
            <Skeleton tone="stellar" width={70} height={14} />
            <Skeleton tone="stellar" width="100%" height={38} borderRadius={8} />
          </div>
          <div className="form-row" style={{ display: "grid", gap: 8 }}>
            <Skeleton tone="stellar" width={90} height={14} />
            <Skeleton tone="stellar" width="100%" height={120} borderRadius={8} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Skeleton tone="stellar" width={130} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={130} height={38} borderRadius={8} />
          </div>
        </div>
      </div>

      {/* Usage Statistics Section Skeleton */}
      <div className="surface usage-stats-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <Skeleton tone="stellar" width={150} height={20} style={{ marginBottom: 20 }} />
        <div className="stats-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card" style={{ display: "grid", gap: 8, padding: 16 }}>
              <Skeleton tone="stellar" width="60%" height={12} />
              <Skeleton tone="stellar" width="80%" height={24} />
            </div>
          ))}
        </div>
        <div className="mini-chart" style={{ marginTop: 24 }}>
          <Skeleton tone="stellar" width={130} height={16} style={{ marginBottom: 16 }} />
          <Skeleton tone="stellar" width="100%" height={160} borderRadius={8} />
        </div>
      </div>

      {/* Call History Section Skeleton */}
      <div className="surface call-history-section" aria-hidden="true" style={{ marginBottom: 24 }}>
        <div className="section-header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <Skeleton tone="stellar" width={120} height={20} />
          <div className="history-actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Skeleton tone="stellar" width={220} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
            <Skeleton tone="stellar" width={100} height={38} borderRadius={8} />
          </div>
        </div>
        <div className="call-history-table">
          <div className="table-header">
            <span>Timestamp</span>
            <span>Endpoint</span>
            <span>Status</span>
            <span>Response Time</span>
            <span>Cost</span>
            <span>Actions</span>
          </div>
          <SkeletonRow rows={5} />
        </div>
      </div>

      {/* Integration Guide Section Skeleton */}
      <div className="surface integration-guide-section" aria-hidden="true">
        <Skeleton tone="stellar" width={160} height={20} style={{ marginBottom: 20 }} />
        <div className="language-tabs" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <Skeleton tone="stellar" width={100} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={80} height={36} borderRadius={8} />
          <Skeleton tone="stellar" width={70} height={36} borderRadius={8} />
        </div>
        <div className="code-example">
          <div className="code-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
            <Skeleton tone="stellar" width={150} height={16} />
            <Skeleton tone="stellar" width={90} height={32} borderRadius={6} />
          </div>
          <div className="code-block" style={{ padding: 20, display: "grid", gap: 10 }}>
            <Skeleton tone="stellar" width="85%" height={14} />
            <Skeleton tone="stellar" width="60%" height={14} />
            <Skeleton tone="stellar" width="75%" height={14} />
            <Skeleton tone="stellar" width="40%" height={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApiDetailPageSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <div
      className="api-detail-page"
      aria-busy="true"
      aria-label="API detail loading shell"
    >
      <div className="api-detail-container">
        <Breadcrumb
          items={[
            { label: "Marketplace", href: "/marketplace" },
            { label: "Loading…", href: "", isCurrent: true },
          ]}
        />
        <div className="api-detail-shell">
          <div className="api-detail-hero">
            <div className="api-detail-heading">
              <button className="ghost-button no-print" onClick={onBack} type="button">
                Back
              </button>
              <div className="api-detail-brand" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Skeleton tone="stellar" width={56} height={56} borderRadius={10} />
                <div className="api-detail-title" style={{ flex: 1, display: "grid", gap: 8 }}>
                  <Skeleton tone="stellar" width="60%" height={32} />
                  <Skeleton tone="stellar" width="40%" height={16} />
                </div>
              </div>
            </div>
            <div className="api-detail-price-panel" style={{ display: "grid", gap: 8 }}>
              <Skeleton tone="stellar" width={100} height={32} />
              <Skeleton tone="stellar" width={120} height={14} />
              <Skeleton tone="stellar" width="100%" height={44} borderRadius={8} />
            </div>
          </div>

          <div className="api-detail-content-grid">
            <div className="content-left">
              <nav className="api-detail-tabs no-print" style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton tone="stellar" key={i} width={80} height={20} />
                ))}
              </nav>
              <div className="api-detail-metrics" style={{ display: "flex", gap: 16 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="stat-card-skeleton" style={{ padding: 20, flex: 1, display: "grid", gap: 12 }}>
                    <Skeleton tone="stellar" width="40%" height={12} />
                    <Skeleton tone="stellar" width="60%" height={28} />
                  </div>
                ))}
              </div>
            </div>

            <aside className="api-detail-sidebar no-print">
              <div className="api-detail-sidebar-inner" style={{ display: "grid", gap: 20 }}>
                <div className="stat-card-skeleton" style={{ padding: 24, display: "grid", gap: 12 }}>
                  <Skeleton tone="stellar" width="50%" height={20} />
                  <Skeleton tone="stellar" width="100%" height={16} />
                  <Skeleton tone="stellar" width="100%" height={16} />
                  <Skeleton tone="stellar" width="100%" height={16} />
                </div>
                <div className="preview-card-skeleton" style={{ padding: 24, display: "grid", gap: 12 }}>
                  <Skeleton tone="stellar" width="50%" height={20} />
                  <Skeleton tone="stellar" width="100%" height={36} />
                  <Skeleton tone="stellar" width="100%" height={36} />
                  <Skeleton tone="stellar" width="100%" height={36} />
                </div>
                <div style={{ padding: 24, borderRadius: 16, border: "1px solid var(--line)", display: "grid", gap: 12 }}>
                  <Skeleton tone="stellar" width="50%" height={20} />
                  <Skeleton tone="stellar" width="100%" height={14} />
                  <Skeleton tone="stellar" width="100%" height={14} />
                  <Skeleton tone="stellar" width="100%" height={44} borderRadius={8} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}


