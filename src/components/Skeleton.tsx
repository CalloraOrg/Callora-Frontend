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
    <div className="filters-sidebar-skeleton" aria-hidden="true" style={{ display: "grid", gap: 16 }}>
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

export function ApiTagFilterSkeleton({ pills = 6 }: { pills?: number }) {
  return (
    <div className="api-tag-filter" aria-hidden="true" role="presentation">
      {Array.from({ length: pills }).map((_, i) => (
        <Skeleton
          key={i}
          width={70 + (i % 3) * 20}
          height={32}
          borderRadius={16}
          className="api-tag-filter__pill"
          style={{ padding: 0, border: "none" }}
        />
      ))}
    </div>
  );
}
