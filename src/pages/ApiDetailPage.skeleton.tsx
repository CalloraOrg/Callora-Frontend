import Skeleton from "../components/Skeleton";

function SidebarCardSkeleton() {
  return (
    <div
      className="preview-card-skeleton"
      style={{ padding: 24, display: "grid", gap: 12 }}
      aria-hidden="true"
    >
      <Skeleton tone="stellar" width="58%" height={20} />
      <Skeleton tone="stellar" width="100%" height={14} />
      <Skeleton tone="stellar" width="100%" height={14} />
      <Skeleton tone="stellar" width="72%" height={14} />
      <Skeleton tone="stellar" width="100%" height={40} borderRadius={10} />
    </div>
  );
}

export default function ApiDetailPageSkeleton() {
  return (
    <div
      className="api-detail-page"
      aria-busy="true"
      aria-label="API detail loading shell"
    >
      <div className="api-detail-container">
        <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
          <Skeleton tone="stellar" width="38%" height={16} />
          <Skeleton tone="stellar" width="26%" height={16} />
        </div>

        <div className="api-detail-shell">
          <div className="api-detail-hero">
            <div className="api-detail-heading">
              <Skeleton tone="stellar" width={72} height={36} borderRadius={10} />

              <div className="api-detail-brand" style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                <Skeleton tone="stellar" width={56} height={56} borderRadius={12} />
                <div className="api-detail-title" style={{ flex: 1, display: "grid", gap: 10 }}>
                  <Skeleton tone="stellar" width="62%" height={32} />
                  <Skeleton tone="stellar" width="42%" height={16} />
                </div>
              </div>
            </div>

            <div className="api-detail-price-panel" style={{ display: "grid", gap: 10 }}>
              <Skeleton tone="stellar" width="55%" height={32} />
              <Skeleton tone="stellar" width="70%" height={14} />
              <Skeleton tone="stellar" width="100%" height={44} borderRadius={8} />
            </div>
          </div>

          <div className="api-detail-content-grid">
            <div className="content-left">
              <nav className="api-detail-tabs no-print" aria-hidden="true" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton tone="stellar" key={index} width={88} height={20} />
                ))}
              </nav>

              <div className="api-detail-metrics">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="stat-card-skeleton" style={{ padding: 20, display: "grid", gap: 12 }}>
                    <Skeleton tone="stellar" width="42%" height={12} />
                    <Skeleton tone="stellar" width="62%" height={28} />
                  </div>
                ))}
              </div>
            </div>

            <aside className="api-detail-sidebar no-print" aria-hidden="true">
              <div className="api-detail-sidebar-inner" style={{ display: "grid", gap: 20 }}>
                <SidebarCardSkeleton />
                <SidebarCardSkeleton />
                <SidebarCardSkeleton />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
