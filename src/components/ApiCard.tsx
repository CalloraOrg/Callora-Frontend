import { useState } from "react";

export default function ApiCard({
  api,
  onViewDetails,
}: {
  api: any;
  onViewDetails?: (api: any) => void;
}) {
  const [hover, setHover] = useState(false);

  const currency = (n: number) => `$${n.toFixed(3)}`;

  return (
    <article
      className="preview-card"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onViewDetails?.(api);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 12,
        transition: "box-shadow 160ms ease, transform 160ms ease",
        boxShadow: hover ? "0 6px 20px rgba(0,0,0,0.12)" : "none",
        transform: hover ? "translateY(-4px)" : "none",
        border: hover
          ? "1px solid #4666ff"
          : "1px solid rgba(255,255,255,0.03)",
        display: "flex",
        flexDirection: "column",
        minHeight: 220,
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
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

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
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

        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {currency(api.pricePerRequest)} / req
          </div>
          {api.rating !== undefined && (
            <div style={{ color: "var(--muted)", marginTop: 6 }}>
              ⭐ {api.rating}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <button
          className="ghost-button"
          onClick={() => onViewDetails?.(api)}
          aria-label={`View details for ${api.name}`}
        >
          View Details
        </button>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          {api.rating ? `${api.rating} ★` : "No reviews"}
        </div>
      </div>
    </article>
  );
}
