import Skeleton from "./Skeleton";
import { formatPrice } from "../utils/format";
import type { APIItem } from "../data/mockApis";

export function ApiCardSkeleton() {
  return (
    <article
      className="preview-card api-marketplace-card"
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        minHeight: 220,
        gap: 8,
        border: "1px solid rgba(255,255,255,0.03)",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton width={56} height={56} borderRadius={10} />

        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="20%" height={12} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Skeleton width="90%" height={14} />
            <Skeleton width="70%" height={14} />
          </div>
        </div>

        <div
          style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <Skeleton width={50} height={12} />
          <Skeleton width={40} height={16} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <Skeleton width={45} height={24} borderRadius={8} />
        <Skeleton width={55} height={24} borderRadius={8} />
        <Skeleton width={40} height={24} borderRadius={8} />
      </div>

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="api-card__stats" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="api-card__stat">
              <Skeleton width="55%" height={10} />
              <Skeleton width="75%" height={16} />
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Skeleton width={100} height={36} borderRadius={14} />
          <Skeleton width={60} height={14} />
        </div>
      </div>
    </article>
  );
}

const EM_DASH = "—";

function renderStatValue(value: string | undefined) {
  if (!value) {
    return (
      <span className="api-card__stat-value api-card__stat-value--empty">
        {EM_DASH}
      </span>
    );
  }

  return <span className="api-card__stat-value">{value}</span>;
}

export default function ApiCard({
  api,
  onViewDetails,
}: {
  api: APIItem;
  onViewDetails?: (api: APIItem) => void;
}) {
  const pricePerCall = api.pricePerCall ?? api.pricePerRequest;
  const avgLatencyMs = api.avgLatencyMs;
  const uptimePercent = api.uptimePercent;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onViewDetails?.(api);
    }
  };

  return (
    <article
      className="preview-card api-marketplace-card"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${api.name}`}
      onClick={() => onViewDetails?.(api)}
      onKeyDown={handleKeyDown}
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        minHeight: 220,
        gap: 8,
      }}
    >
      <div
        className="api-marketplace-card-header"
        style={{ display: "flex", gap: 12, alignItems: "center" }}
      >
        <div
          className="api-marketplace-card-icon"
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          {api.name[0]}
        </div>

        <div
          className="api-marketplace-card-body"
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          <div
            className="api-marketplace-card-title-row"
            style={{ display: "flex", gap: 8, alignItems: "baseline" }}
          >
            <strong>{api.name}</strong>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              {api.provider?.name}
            </div>
          </div>

          <div
            style={{
              color: "var(--muted)",
              marginTop: 6,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {api.description}
          </div>
        </div>

        <div
          className="api-marketplace-card-price"
          style={{ textAlign: "right" }}
        >
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {`$${formatPrice(pricePerCall)}`} / call
          </div>
          {api.rating !== undefined && (
            <div style={{ color: "var(--muted)", marginTop: 6 }}>
              ⭐ {api.rating}
            </div>
          )}
        </div>
      </div>

      <div
        className="api-marketplace-card-tags"
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        {((api.tags as string[]) || []).slice(0, 4).map((t: string) => (
          <span
            key={t}
            style={{
              fontSize: 12,
              color: "var(--muted)",
              background: "rgba(255,255,255,0.02)",
              padding: "4px 8px",
              borderRadius: 8,
            }}
          >
            {t}
          </span>
        ))}
      </div>

      <div
        className="api-marketplace-card-footer"
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Always render three cells so marketplace rows keep consistent heights while missing values stay scannable. */}
        <div className="api-card__stats" aria-label="API stats">
          <div className="api-card__stat">
            <span className="api-card__stat-label">Price / call</span>
            {renderStatValue(
              pricePerCall !== undefined
                ? `$${formatPrice(pricePerCall)}`
                : undefined,
            )}
          </div>

          <div className="api-card__stat">
            <span className="api-card__stat-label">Latency</span>
            {renderStatValue(
              avgLatencyMs !== undefined ? `${avgLatencyMs} ms` : undefined,
            )}
          </div>

          <div className="api-card__stat">
            <span className="api-card__stat-label">Uptime</span>
            {renderStatValue(
              uptimePercent !== undefined
                ? `${uptimePercent.toFixed(2)}%`
                : undefined,
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            className="ghost-button"
            aria-hidden="true"
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            View Details
          </span>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {api.rating ? `${api.rating} ★` : "No reviews"}
          </div>
        </div>
      </div>
    </article>
  );
}
