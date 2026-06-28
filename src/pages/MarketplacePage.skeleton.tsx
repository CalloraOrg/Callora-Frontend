import Skeleton from "../components/Skeleton";

function MarketplaceCardSkeleton() {
  return (
    <article
      className="preview-card api-marketplace-card"
      aria-hidden="true"
      style={{ padding: 16, display: "grid", gap: 12, minHeight: 220 }}
    >
      <Skeleton width={56} height={56} borderRadius={10} />
      <Skeleton width="68%" height={18} />
      <Skeleton width="88%" height={14} />
      <Skeleton width="74%" height={14} />
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Skeleton width={48} height={24} borderRadius={999} />
        <Skeleton width={64} height={24} borderRadius={999} />
        <Skeleton width={40} height={24} borderRadius={999} />
      </div>
      <Skeleton width="100%" height={36} borderRadius={14} style={{ marginTop: "auto" }} />
    </article>
  );
}

function FilterBlockSkeleton() {
  return (
    <section
      className="filters-sidebar"
      aria-hidden="true"
      style={{ display: "grid", gap: 16 }}
    >
      <Skeleton width="55%" height={22} />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} style={{ display: "grid", gap: 8 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={40} borderRadius={10} />
        </div>
      ))}
      <Skeleton width="48%" height={14} />
      <Skeleton width="100%" height={44} borderRadius={12} />
    </section>
  );
}

export default function MarketplacePageSkeleton() {
  return (
    <div
      className="marketplace-page"
      aria-busy="true"
      aria-label="Marketplace loading shell"
    >
      <div className="marketplace-header">
        <Skeleton width={240} height={42} />

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

        <Skeleton width={170} height={40} borderRadius={12} />
      </div>

      <div className="marketplace-layout">
        <aside className="marketplace-sidebar">
          <FilterBlockSkeleton />
        </aside>

        <main className="marketplace-results">
          <div className="marketplace-toolbar">
            <Skeleton width="42%" height={18} />
            <div className="marketplace-actions" aria-hidden="true">
              <Skeleton width={142} height={40} borderRadius={10} />
              <Skeleton width={110} height={40} borderRadius={10} />
            </div>
          </div>

          <div className="marketplace-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <MarketplaceCardSkeleton key={index} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
