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
      {/* Filter groups */}
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} style={{ display: "grid", gap: 8 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={40} borderRadius={10} />
        </div>
      ))}
      {/* Price range label */}
      <Skeleton width="48%" height={14} />
      {/* Apply / clear button */}
      <Skeleton width="100%" height={44} borderRadius={12} />
    </div>
  );
}

export function EmptyStateSkeleton({
  size = "default",
  hasAction = false,
}: {
  size?: "default" | "compact";
  hasAction?: boolean;
}) {
  const isCompact = size === "compact";

  const wrapperStyle: CSSProperties = isCompact
    ? {
        textAlign: "center",
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "var(--surface-soft)",
        border: "1px solid var(--line)",
        borderRadius: "10px",
        width: "100%",
        boxSizing: "border-box",
      }
    : {
        textAlign: "center",
        padding: "48px 32px",
        minHeight: "300px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        boxSizing: "border-box",
      };

  const illustrationSize = isCompact ? 56 : 80;
  const illustrationMargin = isCompact ? "0" : "0 auto 24px";

  return (
    <div
      style={wrapperStyle}
      className={`empty-state-skeleton${isCompact ? " empty-state-skeleton--compact" : ""}`}
      aria-busy="true"
      aria-label="Loading empty state"
    >
      <Skeleton
        width={illustrationSize}
        height={illustrationSize}
        borderRadius="50%"
        style={{
          margin: illustrationMargin,
          flexShrink: 0,
          border: "1px solid var(--line)",
        }}
        tone="stellar"
      />

      {isCompact ? (
        <Skeleton width="50%" height={14} tone="stellar" borderRadius={4} />
      ) : (
        <Skeleton
          width="40%"
          height={22}
          borderRadius={6}
          style={{ marginBottom: 12 }}
          tone="stellar"
        />
      )}

      {isCompact ? (
        <Skeleton width="70%" height={12} tone="stellar" borderRadius={4} />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            marginBottom: hasAction ? 24 : 0,
            width: "100%",
          }}
        >
          <Skeleton width="55%" height={14} tone="stellar" borderRadius={4} />
          <Skeleton width="35%" height={14} tone="stellar" borderRadius={4} />
        </div>
      )}

      {hasAction && (
        <Skeleton
          width={isCompact ? 120 : 160}
          height={isCompact ? 36 : 44}
          borderRadius={14}
          tone="stellar"
        />
      )}
    </div>
  );
}


